import { Request, Response } from "express";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import {
  accumulateMeteredUsage,
  buildMeteredSessionKey,
  checkMeteredZeroBalanceGuard,
  currentUsageRequestId,
  getRememberedSessionConversationProfile,
  PIXEL_USD,
  recordPixelCharge,
  recordProviderUsage,
  recordUsageEvent,
  recordUsagePixelBalance,
  settleMeteredSession,
  verifyConversationSessionOwnership,
} from "./aiUsageLedger";
import {
  extractConversationPolicyVersion,
  isPaidConversationProfile,
  resolveAdmittedConversationProfile,
  resolveConversationProfile,
} from "./conversationModels";
import { authenticatedOwnerId, authenticatedUserId } from "./requestAuth";
import { fishVoice, isFishVoiceId } from './fishVoiceCatalog';
import { streamFishSpeech, FishSpeechError, type FishSpeechStats } from './FishSpeech';
import { recordFishSpeechUsage } from './FishUsage';
dotenv.config();

type VoiceOption = {
  id: string;
  tone: string;
};

type TtsModelConfig = {
  id: string;
  mode: "stream" | "buffer";
  fallback: boolean;
};

const VOICES: VoiceOption[] = [
  { id: "Achernar", tone: "Soft" },
  { id: "Achird", tone: "Friendly" },
  { id: "Algenib", tone: "Gravelly" },
  { id: "Algieba", tone: "Smooth" },
  { id: "Alnilam", tone: "Firm" },
  { id: "Aoede", tone: "Breezy" },
  { id: "Autonoe", tone: "Bright" },
  { id: "Callirrhoe", tone: "Easy-going" },
  { id: "Charon", tone: "Informative" },
  { id: "Despina", tone: "Smooth" },
  { id: "Enceladus", tone: "Breathy" },
  { id: "Erinome", tone: "Clear" },
  { id: "Fenrir", tone: "Excitable" },
  { id: "Gacrux", tone: "Mature" },
  { id: "Iapetus", tone: "Clear" },
  { id: "Kore", tone: "Firm" },
  { id: "Laomedeia", tone: "Upbeat" },
  { id: "Leda", tone: "Youthful" },
  { id: "Orus", tone: "Firm" },
  { id: "Puck", tone: "Upbeat" },
  { id: "Pulcherrima", tone: "Forward" },
  { id: "Rasalgethi", tone: "Informative" },
  { id: "Sadachbia", tone: "Lively" },
  { id: "Sadaltager", tone: "Knowledgeable" },
  { id: "Schedar", tone: "Even" },
  { id: "Sulafat", tone: "Warm" },
  { id: "Umbriel", tone: "Easy-going" },
  { id: "Vindemiatrix", tone: "Gentle" },
  { id: "Zephyr", tone: "Bright" },
  { id: "Zubenelgenubi", tone: "Casual" },
];

const DEFAULT_VOICE = VOICES[0];
const SAMPLE_RATE = 24000;
const TTS_FIRST_AUDIO_TIMEOUT_MS = 8000;
const TTS_BUFFER_TIMEOUT_MS = 15000;
const TTS_MODEL_CHAIN: TtsModelConfig[] = [
  { id: "gemini-3.1-flash-tts-preview", mode: "stream", fallback: false },
  { id: "gemini-2.5-flash-preview-tts", mode: "buffer", fallback: true },
  { id: "gemini-2.5-pro-preview-tts", mode: "buffer", fallback: true },
];

let geminiTtsClient: GoogleGenAI | null = null;

function getGeminiTtsClient(): GoogleGenAI {
  if (geminiTtsClient) return geminiTtsClient;

  const apiKey =
    process.env.GOOGLE_LIVE_KEY ||
    process.env.GOOGLE_TTS_KEY ||
    process.env.VITE_GOOGLE_TTS ||
    process.env.GOOGLE_KEY;

  if (!apiKey) {
    throw new Error("Missing Gemini API key for voice TTS");
  }

  geminiTtsClient = new GoogleGenAI({ apiKey });
  return geminiTtsClient;
}

function pickVoice(voiceId: unknown): VoiceOption {
  const requested = String(voiceId || "").trim();
  return VOICES.find((voice) => voice.id === requested) || DEFAULT_VOICE;
}

function getAudioBuffers(chunk: any): Buffer[] {
  const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part: any) => part?.inlineData?.data)
    .filter(Boolean)
    .map((data: any) => Buffer.from(String(data), "base64"));
}

function getErrorDetail(err: any): string {
  const fields = [
    err?.message,
    err?.status,
    err?.code,
    err?.error?.message,
    err?.error?.status,
  ];
  return fields.filter(Boolean).map(String).join(" ");
}

function isQuotaError(err: any): boolean {
  const detail = getErrorDetail(err).toLowerCase();
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    detail.includes("429") ||
    detail.includes("resource_exhausted") ||
    detail.includes("too many requests") ||
    detail.includes("quota") ||
    detail.includes("rate limit")
  );
}

function isNoAudioError(err: any): boolean {
  const detail = getErrorDetail(err).toLowerCase();
  return detail.includes('no audio') || detail.includes('before audio');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildTtsRequest(model: string, voice: VoiceOption, text: string) {
  return {
    model,
    contents: [{ role: "user", parts: [{ text: `Say exactly, with no extra words: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice.id,
          },
        },
      },
    },
  };
}

export const voiceTtsStreamRoute = async (req: Request, res: Response): Promise<any> => {
  const requestStartedAt = Date.now();
  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).send({ message: "Missing text" });
  }

  const requestedFish = fishVoice(req.body?.voice);
  if (isFishVoiceId(req.body?.voice) && !requestedFish) return res.status(400).json({ message: 'Choose an available Fish voice.' });
  const voice = pickVoice(requestedFish?.fallbackGemini || req.body?.voice);
  const sessionScopeId = String(
    req.headers["x-clikb-conversation-session"] || req.body?.sessionId || "default",
  ).trim().slice(0, 120) || "default";
  const authedUserId = authenticatedUserId(req);
  if (req.body?.userId !== undefined && req.body?.userId !== null && String(req.body.userId).trim() !== "") {
    if (!authedUserId) {
      return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }
    if (String(req.body.userId).trim() !== authedUserId) {
      return res.status(403).json({ message: "You cannot access another member's pixel balance." });
    }
  }
  if (authedUserId && !verifyConversationSessionOwnership(sessionScopeId, authedUserId)) {
    return res.status(403).json({ message: "This conversation session belongs to another member." });
  }

  const explicitTier = req.body?.conversationModel;
  const rememberedTier = getRememberedSessionConversationProfile(sessionScopeId, authedUserId || undefined);
  const rawRequestedProfile = resolveConversationProfile(explicitTier || rememberedTier || "luna");
  if (rawRequestedProfile && isPaidConversationProfile(rawRequestedProfile.tier) && !authedUserId) {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }

  const policyVersion = extractConversationPolicyVersion(req);
  const resolvedProfile = explicitTier
    ? resolveAdmittedConversationProfile(explicitTier, { policyVersion })
    : resolveConversationProfile(rememberedTier || "luna");
  if (resolvedProfile?.policyMigrated) {
    res.setHeader(
      "X-ClikB-AI-Notice",
      `Conversation model migrated from ${resolvedProfile.requestedTier} to Luna · Low under current billing policy.`,
    );
  }
  const isPaidVoice = Boolean(resolvedProfile && isPaidConversationProfile(resolvedProfile.tier));
  if (isPaidVoice && !authedUserId) {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
  const userId = authenticatedOwnerId(req) || "";
  const billingSessionKey = isPaidVoice && userId ? buildMeteredSessionKey("concierge", userId, "account") : "";

  if (isPaidVoice) {
    const guard = await checkMeteredZeroBalanceGuard(userId, 1);
    if (!guard.allowed) {
      return res.status(402).json({
        message: "Not enough pixels for paid Concierge voice.",
        pixels: guard.balance,
        required: 1,
        zeroBalanceReached: true,
      });
    }
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Audio-Encoding", "PCM_S16LE");
  res.setHeader("X-Audio-Sample-Rate", String(SAMPLE_RATE));
  res.setHeader("X-Voice", voice.id);
  res.setHeader("X-TTS-Engine", "gemini-tts");

  let ended = false;
  let wroteAudio = false;
  let activeModel = TTS_MODEL_CHAIN[0].id;
  let audioBytes = 0;
  let firstAudioAt: number | null = null;
  let reportedInputTokens: number | null = null;
  let reportedOutputTokens: number | null = null;
  let usageRecorded = false;
  let usageWork: Promise<void> | null = null;
  let fishStats: FishSpeechStats | undefined;
  const fishAbort = new AbortController();

  const captureUsage = (value: any) => {
    const usage = value?.usageMetadata ?? value?.usage_metadata;
    if (!usage) return;
    const input = usage.promptTokenCount ?? usage.prompt_token_count;
    const output = usage.candidatesTokenCount ?? usage.candidates_token_count;
    if (Number.isInteger(input) && input >= 0) reportedInputTokens = Math.max(reportedInputTokens ?? 0, input);
    if (Number.isInteger(output) && output >= 0) reportedOutputTokens = Math.max(reportedOutputTokens ?? 0, output);
  };

  const recordTtsUsage = (): Promise<void> => {
    if (usageRecorded || !wroteAudio) return usageWork || Promise.resolve();
    usageRecorded = true;
    usageWork = (async () => {
    if (fishStats && requestedFish) {
      recordFishSpeechUsage(fishStats, requestedFish.id, 'concierge');
      return;
    }
    const durationSeconds = audioBytes / (SAMPLE_RATE * 2);
    const estimatedInputTokens = Math.max(1, Math.ceil(text.length / 4));
    const estimatedOutputTokens = Math.max(1, Math.ceil(durationSeconds * (activeModel.startsWith("gemini-3.1") ? 25 : 32)));
    const hasReportedUsage = reportedInputTokens !== null && reportedOutputTokens !== null && reportedOutputTokens > 0;
    const inputTokens = reportedInputTokens ?? estimatedInputTokens;
    const outputTokens = reportedOutputTokens ?? estimatedOutputTokens;
    const isFlash25 = activeModel === "gemini-2.5-flash-preview-tts";
    const inputRate = isFlash25 ? 0.50 : 1.00;
    const outputRate = isFlash25 ? 10.00 : 20.00;
    const providerCostUsd = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
    const rawPixels = providerCostUsd / PIXEL_USD;
    recordProviderUsage({
      provider: "google",
      model: activeModel,
      inputTokens,
      outputTokens,
      outputAudioTokens: outputTokens,
      durationSeconds,
      providerCostUsd,
      pricingSource: "https://ai.google.dev/gemini-api/docs/pricing",
      usageQuality: hasReportedUsage ? "reported" : "estimated",
      metadata: {
        audioBytes,
        voice: voice.id,
        latencyMs: Date.now() - requestStartedAt,
        timeToFirstAudioMs: firstAudioAt === null ? null : firstAudioAt - requestStartedAt,
        inputCharacters: text.length,
        billableToUser: isPaidVoice && hasReportedUsage,
      },
    });
    if (isPaidVoice && !hasReportedUsage) {
      recordUsageEvent("voice.billing_pending", { reason: "Provider token usage unavailable; estimated TTS cost is telemetry only." });
    }
    if (isPaidVoice && resolvedProfile && hasReportedUsage) {
      await accumulateMeteredUsage({
        eventId: `tts:${currentUsageRequestId() || requestStartedAt}:${audioBytes}`,
        userId,
        sessionKey: billingSessionKey,
        workload: "voice",
        profile: resolvedProfile.tier,
        model: activeModel,
        rawPixels,
        providerCostUsd,
        billableToUser: true,
      });
      const receipt = await settleMeteredSession({
        sessionKey: billingSessionKey,
        userId,
        workload: "voice",
        profile: resolvedProfile.tier,
        model: activeModel,
      });
      if (receipt?.pixelsCharged) recordPixelCharge(receipt.pixelsCharged, "concierge-voice-tts");
      if (typeof receipt?.remainingPixels === "number") recordUsagePixelBalance(receipt.remainingPixels);
    }
    recordUsageEvent("voice.tts_complete", {
      model: activeModel,
      durationSeconds,
      timeToFirstAudioMs: firstAudioAt === null ? -1 : firstAudioAt - requestStartedAt,
    });
    })().catch(error => {
      // SQL rejection retained the immutable event in the server outbox. Never
      // rerun already delivered speech or pretend that an estimate was charged.
      recordUsageEvent("voice.billing_pending", { reason: "Usage persistence or settlement pending." });
      console.error("[voiceTtsStream] accounting pending:", error?.message);
    });
    return usageWork;
  };

  const failOnce = (err: any) => {
    if (ended) return;
    ended = true;
    const detail = getErrorDetail(err) || String(err || "Unknown Gemini TTS error");
    console.error("[voiceTtsStream] Gemini TTS error:", detail);
    if (!res.headersSent) {
      res.status(502).json({ message: "Voice TTS failed", detail });
      return;
    }
    if (!res.writableEnded) {
      if (fishStats && wroteAudio) res.destroy();
      else res.end();
    }
  };

  const endOnce = async () => {
    if (ended) return;
    ended = true;
    if (!wroteAudio && !res.headersSent) {
      res.status(502).json({ message: "Voice TTS returned no audio" });
      return;
    }
    await recordTtsUsage();
    if (!res.writableEnded) res.end();
  };

  res.on("close", () => {
    fishAbort.abort();
    if (wroteAudio && !usageRecorded) {
      void recordTtsUsage();
    }
    ended = true;
  });

  try {
    if (requestedFish) {
      try {
        const stats = await streamFishSpeech({ voiceId: requestedFish.id, text, format: 'pcm', signal: fishAbort.signal,
          onStats: stats => { fishStats = stats; } }, audio => {
          if (ended || res.writableEnded) throw new Error('Speech client disconnected.');
          if (!wroteAudio) {
            res.setHeader('X-TTS-Engine', 'fish'); res.setHeader('X-TTS-Model', 's2.1-pro');
            res.setHeader('X-TTS-Fallback', 'false'); res.setHeader('X-Voice', requestedFish.id);
            activeModel = 's2.1-pro';
            firstAudioAt = Date.now(); wroteAudio = true;
          }
          audioBytes += audio.length;
          res.write(audio);
        });
        fishStats = stats;
        activeModel = stats.model;
        await endOnce();
        return;
      } catch (error) {
        if (error instanceof FishSpeechError) fishStats = error.stats;
        if (fishStats && !usageRecorded) recordFishSpeechUsage(fishStats, requestedFish.id, 'concierge');
        if (ended || fishAbort.signal.aborted) return;
        // Never replay an utterance or switch codecs after delivery began.
        if (wroteAudio) { usageRecorded = true; failOnce(error); return; }
        return res.status(503).json({ code: 'FISH_SPEECH_UNAVAILABLE',
          message: 'Fish audio could not complete. Please choose another voice from the voice list and try again.' });
      }
    }
    const client = getGeminiTtsClient();
    let lastError: any = null;

    for (let i = 0; i < TTS_MODEL_CHAIN.length; i += 1) {
      const model = TTS_MODEL_CHAIN[i];
      activeModel = model.id;
      reportedInputTokens = null;
      reportedOutputTokens = null;
      if (!res.headersSent) {
        res.setHeader("X-TTS-Model", model.id);
        res.setHeader("X-TTS-Fallback", requestedFish || model.fallback ? "true" : "false");
      }

      try {
        if (model.mode === "stream") {
          const firstAudioDeadline = Date.now() + TTS_FIRST_AUDIO_TIMEOUT_MS;
          const stream = await withTimeout(
            client.models.generateContentStream(buildTtsRequest(model.id, voice, text)),
            TTS_FIRST_AUDIO_TIMEOUT_MS,
            `${model.id} timed out before audio`
          );
          const iterator = stream[Symbol.asyncIterator]();

          while (true) {
            const remainingMs = Math.max(1, firstAudioDeadline - Date.now());
            const next = wroteAudio
              ? await iterator.next()
              : await withTimeout(
                  iterator.next(),
                  remainingMs,
                  `${model.id} timed out before audio`
                );
            if (next.done) break;
            const chunk = next.value;
            captureUsage(chunk);
            if (ended || res.writableEnded) break;
            const buffers = getAudioBuffers(chunk);
            if (!buffers.length) continue;
            wroteAudio = true;
            if (firstAudioAt === null) firstAudioAt = Date.now();
            for (const buffer of buffers) {
              if (ended || res.writableEnded) break;
              audioBytes += buffer.length;
              res.write(buffer);
            }
          }
        } else {
          const response = await withTimeout(
            client.models.generateContent(buildTtsRequest(model.id, voice, text)),
            TTS_BUFFER_TIMEOUT_MS,
            `${model.id} timed out before audio`
          );
          captureUsage(response);
          const buffers = getAudioBuffers(response);
          if (!buffers.length) throw new Error(`${model.id} returned no audio`);
          if (!ended && !res.writableEnded) {
            wroteAudio = true;
            if (firstAudioAt === null) firstAudioAt = Date.now();
            const audio = Buffer.concat(buffers);
            audioBytes += audio.length;
            res.write(audio);
          }
        }

        if (wroteAudio) {
          await endOnce();
          return;
        }

        throw new Error(`${model.id} returned no audio`);
      } catch (err: any) {
        lastError = err;
        const hasNextModel = i < TTS_MODEL_CHAIN.length - 1;
        const canTryNext =
          hasNextModel &&
          !wroteAudio &&
          !res.headersSent &&
          (model.fallback || isQuotaError(err) || isNoAudioError(err));

        if (canTryNext) {
          console.warn(
            `[voiceTtsStream] ${model.id} failed before audio; trying ${TTS_MODEL_CHAIN[i + 1].id}:`,
            getErrorDetail(err) || err
          );
          continue;
        }

        throw err;
      }
    }

    failOnce(lastError || new Error(`${activeModel} returned no audio`));
  } catch (e: any) {
    failOnce(e);
  }
};
