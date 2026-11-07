import { fishVoice, type FishVoice } from './fishVoiceCatalog';
import type { ReadableStreamDefaultReader } from 'node:stream/web';

export type FishSpeechStats = {
  model: string; referenceId: string; inputBytes: number; audioBytes: number;
  accepted: boolean; firstAudioMs: number | null; elapsedMs: number;
};
export class FishSpeechError extends Error {
  constructor(message: string, public readonly stats: FishSpeechStats) { super(message); this.name = 'FishSpeechError'; }
}
export const fishSpeechEnabled = () => process.env.FISH_TTS_ENABLED !== 'false'
  && Boolean(process.env.FISH_KEY || process.env.FISH_AUDIO_API_KEY);

export type FishSpeechOptions = {
  voiceId: string; text: string; direction?: string; format: 'pcm' | 'mp3'; signal?: AbortSignal;
  fetcher?: typeof fetch; firstAudioTimeoutMs?: number; totalTimeoutMs?: number;
  onStats?: (stats: FishSpeechStats) => void;
};

/** One server-only request; cancellation owns the HTTP body as well as headers.
 * The caller alone decides whether fallback is safe, based on delivered bytes. */
export async function streamFishSpeech(options: FishSpeechOptions, deliver: (audio: Buffer) => void | Promise<void>): Promise<FishSpeechStats> {
  const voice = fishVoice(options.voiceId);
  if (!voice) throw new Error('Unknown Fish voice. Choose a voice from the catalogue.');
  if (!fishSpeechEnabled()) throw new Error('Fish speech is disabled or not configured.');
  const text = options.text.trim();
  if (!text || text.length > 16000) throw new Error('Speech text must contain 1–16000 characters.');
  // Existing bracketed delivery tags remain in the spoken script. Extra director
  // notes are conditioning, not additional dialogue.
  const direction = String(options.direction || '').replace(/^DIRECTOR['’]S NOTES:\s*/i, '').trim().slice(0, 500);
  const script = direction ? `[${direction.replace(/[\[\]]/g, '')}]\n${text}` : text;
  const started = Date.now();
  const stats: FishSpeechStats = { model: 's2.1-pro', referenceId: voice.referenceId,
    inputBytes: Buffer.byteLength(script, 'utf8'), audioBytes: 0, accepted: false, firstAudioMs: null, elapsedMs: 0 };
  options.onStats?.(stats);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const firstTimer = setTimeout(cancel, options.firstAudioTimeoutMs ?? 8000);
  const totalTimer = setTimeout(cancel, options.totalTimeoutMs ?? 90000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let prefix = Buffer.alloc(0), checked = false;
  const validate = (buffer: Buffer) => {
    const header = buffer.subarray(0, 4).toString('ascii');
    if (options.format === 'pcm' && (header === 'RIFF' || header === 'OggS' || header.startsWith('ID3'))) {
      throw new Error('Fish returned a container instead of raw PCM.');
    }
    if (options.format === 'mp3' && !header.startsWith('ID3') && !(buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      throw new Error('Fish returned invalid MP3 audio.');
    }
  };
  const emit = async (audio: Buffer) => {
    if (abort.signal.aborted) throw new Error('Fish speech interrupted.');
    if (!audio.length) return;
    if (stats.audioBytes + audio.length > 20 * 1024 * 1024) throw new Error('Fish audio exceeded the response limit.');
    if (stats.firstAudioMs === null) { stats.firstAudioMs = Date.now() - started; clearTimeout(firstTimer); }
    stats.audioBytes += audio.length;
    stats.elapsedMs = Date.now() - started;
    await deliver(audio);
  };
  try {
    const response = await (options.fetcher || fetch)('https://api.fish.audio/v1/tts', {
      method: 'POST', signal: abort.signal,
      headers: { Authorization: `Bearer ${process.env.FISH_KEY || process.env.FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json', model: stats.model },
      body: JSON.stringify({ text: script, reference_id: voice.referenceId, format: options.format,
        sample_rate: options.format === 'pcm' ? 24000 : 44100, latency: 'normal' }),
    });
    if (!response.ok) throw new Error(`Fish speech HTTP ${response.status}`);
    stats.accepted = true;
    const mime = response.headers.get('content-type') || '';
    if (/json|text\//i.test(mime) || options.format === 'pcm' && /wav|mpeg|mp3|ogg/i.test(mime)) {
      throw new Error('Fish returned an unexpected audio format.');
    }
    reader = response.body?.getReader();
    if (!reader) throw new Error('Fish returned no audio stream.');
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const audio = Buffer.from(value);
      if (!checked) {
        prefix = Buffer.concat([prefix, audio]);
        if (prefix.length < 12) continue;
        validate(prefix); checked = true; await emit(prefix); prefix = Buffer.alloc(0);
      } else await emit(audio);
    }
    if (!checked && prefix.length) { validate(prefix); await emit(prefix); }
    if (!stats.audioBytes) throw new Error('Fish returned no audio.');
    if (options.format === 'pcm' && stats.audioBytes % 2) throw new Error('Fish PCM ended with an incomplete sample.');
    stats.elapsedMs = Date.now() - started;
    return stats;
  } catch (error) {
    stats.elapsedMs = Date.now() - started;
    throw new FishSpeechError(abort.signal.aborted ? 'Fish speech cancelled or timed out.'
      : error instanceof Error ? error.message : 'Fish speech failed.', stats);
  } finally {
    clearTimeout(firstTimer); clearTimeout(totalTimer);
    options.signal?.removeEventListener('abort', cancel);
    abort.abort();
    await reader?.cancel().catch(() => undefined);
  }
}

export function fishCostEstimate(stats: FishSpeechStats, voice: FishVoice) {
  const configured = Number(voice.licensed ? process.env.FISH_LICENSED_USD_PER_MILLION_BYTES : process.env.FISH_USD_PER_MILLION_BYTES);
  const verifiedRate = Number.isFinite(configured) && configured > 0;
  // Published ordinary S2.1 rate. A licensed-voice surcharge is not assumed to
  // be verified; estimates are telemetry only, never an authoritative debit.
  const rate = verifiedRate ? configured : 15;
  return { usd: stats.inputBytes * rate / 1_000_000, rate, licensedRateUnconfirmed: voice.licensed && !verifiedRate };
}
