import { recordProviderUsage, recordUsageEvent } from './aiUsageLedger';
import { fishVoice } from './fishVoiceCatalog';
import { fishCostEstimate, type FishSpeechStats } from './FishSpeech';

export function recordFishSpeechUsage(stats: FishSpeechStats, voiceId: string, purpose: string) {
  if (!stats.accepted) return;
  const voice = fishVoice(voiceId);
  if (!voice) return;
  const price = fishCostEstimate(stats, voice);
  recordProviderUsage({ provider: 'fish', model: stats.model, inputTokens: 0, outputTokens: 0,
    durationSeconds: purpose === 'concierge' ? stats.audioBytes / 48000 : undefined,
    providerCostUsd: price.usd, usageQuality: 'estimated', pricingSource: 'https://fish.audio/developers/',
    metadata: { purpose, voice: voiceId, referenceId: stats.referenceId, inputUtf8Bytes: stats.inputBytes,
      audioBytes: stats.audioBytes, timeToFirstAudioMs: stats.firstAudioMs, latencyMs: stats.elapsedMs,
      usdPerMillionBytes: price.rate, licensedRateUnconfirmed: price.licensedRateUnconfirmed,
      billableToUser: false, estimateOnly: true } });
  recordUsageEvent('voice.fish_usage_estimated', { purpose,
    reason: 'Provider billing is estimated from UTF-8 input bytes; no automatic Pixel debit from estimated usage.' });
}
