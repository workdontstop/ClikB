import { Request, Response } from "express";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
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
  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).send({ message: "Missing text" });
  }

  const voice = pickVoice(req.body?.voice);

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

  const failOnce = (err: any) => {
    if (ended) return;
    ended = true;
    const detail = getErrorDetail(err) || String(err || "Unknown Gemini TTS error");
    console.error("[voiceTtsStream] Gemini TTS error:", detail);
    if (!res.headersSent) {
      res.status(502).json({ message: "Voice TTS failed", detail });
      return;
    }
    if (!res.writableEnded) res.end();
  };

  const endOnce = () => {
    if (ended) return;
    ended = true;
    if (!wroteAudio && !res.headersSent) {
      res.status(502).json({ message: "Voice TTS returned no audio" });
      return;
    }
    if (!res.writableEnded) res.end();
  };

  res.on("close", () => {
    ended = true;
  });

  try {
    const client = getGeminiTtsClient();
    let lastError: any = null;

    for (let i = 0; i < TTS_MODEL_CHAIN.length; i += 1) {
      const model = TTS_MODEL_CHAIN[i];
      activeModel = model.id;
      if (!res.headersSent) {
        res.setHeader("X-TTS-Model", model.id);
        res.setHeader("X-TTS-Fallback", model.fallback ? "true" : "false");
      }

      try {
        if (model.mode === "stream") {
          const stream = await client.models.generateContentStream(buildTtsRequest(model.id, voice, text));

          for await (const chunk of stream) {
            if (ended || res.writableEnded) break;
            const buffers = getAudioBuffers(chunk);
            if (!buffers.length) continue;
            wroteAudio = true;
            for (const buffer of buffers) {
              if (ended || res.writableEnded) break;
              res.write(buffer);
            }
          }
        } else {
          const response = await client.models.generateContent(buildTtsRequest(model.id, voice, text));
          const buffers = getAudioBuffers(response);
          if (!buffers.length) throw new Error(`${model.id} returned no audio`);
          if (!ended && !res.writableEnded) {
            wroteAudio = true;
            res.write(Buffer.concat(buffers));
          }
        }

        if (wroteAudio) {
          endOnce();
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
          (model.fallback || isQuotaError(err));

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
