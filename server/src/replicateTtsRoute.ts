import { Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import Replicate from "replicate";
import { GoogleGenAI, Modality } from "@google/genai";
import { fishVoice, isFishVoiceId } from './fishVoiceCatalog';
import { streamFishSpeech, FishSpeechError } from './FishSpeech';
import { recordFishSpeechUsage } from './FishUsage';

dotenv.config();

let geminiTtsClient: GoogleGenAI | null = null;

function getGeminiTtsClient(): GoogleGenAI | null {
  if (geminiTtsClient) return geminiTtsClient;

  const apiKey =
    process.env.GOOGLE_LIVE_KEY ||
    process.env.GOOGLE_TTS_KEY ||
    process.env.VITE_GOOGLE_TTS ||
    process.env.GOOGLE_KEY;

  if (!apiKey) {
    return null;
  }

  geminiTtsClient = new GoogleGenAI({ apiKey });
  return geminiTtsClient;
}

/**
 * Adds a standard 44-byte RIFF WAV header to raw PCM audio data.
 */
function addWavHeader(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("utf8", 0, 4) === "RIFF") {
    return pcmBuffer;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function generateDirectGoogleTts(
  text: string,
  voice?: string,
  prompt?: string
): Promise<Buffer | null> {
  const client = getGeminiTtsClient();
  if (!client) return null;

  const voiceName = String(voice || "Puck").trim() || "Puck";
  const promptInstruction = prompt ? `${prompt}\n\n` : "";
  const fullPrompt = `${promptInstruction}Say exactly, with no extra words: ${text}`;

  const models = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

  for (const model of models) {
    try {
      const response: any = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });

      const parts = response?.candidates?.[0]?.content?.parts ?? [];
      const buffers = parts
        .map((part: any) => part?.inlineData?.data)
        .filter(Boolean)
        .map((data: any) => Buffer.from(String(data), "base64"));

      if (buffers.length > 0) {
        const rawPcm = Buffer.concat(buffers);
        return addWavHeader(rawPcm, 24000, 1, 16);
      }
    } catch (err: any) {
      console.warn(`[generateDirectGoogleTts] ${model} attempt failed:`, err?.message || err);
    }
  }

  return null;
}

export const generateReplicateTtsAudio = async (req: Request, res: Response): Promise<any> => {
  try {
    const { text, prompt, language_code } = req.body;
    let voice = req.body.voice;

    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    const selected = fishVoice(voice);
    if (isFishVoiceId(voice) && !selected) return res.status(400).json({ error: 'Choose an available Fish voice.' });
    if (selected) {
      const abort = new AbortController();
      const close = () => { if (!res.writableEnded) abort.abort(); };
      res.once('close', close);
      try {
        const chunks: Buffer[] = [];
        const stats = await streamFishSpeech({ voiceId: selected.id, text: String(text), direction: prompt,
          format: 'mp3', signal: abort.signal }, audio => { chunks.push(audio); });
        recordFishSpeechUsage(stats, selected.id, 'narration');
        if (abort.signal.aborted) return;
        return res.json({ audioContent: Buffer.concat(chunks).toString('base64'), mimeType: 'audio/mpeg',
          provider: 'fish', voice: selected.id, model: stats.model });
      } catch (error) {
        if (error instanceof FishSpeechError) recordFishSpeechUsage(error.stats, selected.id, 'narration');
        if (abort.signal.aborted) return;
        return res.status(503).json({ code: 'FISH_SPEECH_UNAVAILABLE',
          error: 'Fish audio could not complete. Please choose another voice from the voice list and try again.' });
      } finally { res.off('close', close); }
    }

    console.log("[TTS] Generating audio with voice:", voice || "default");

    // 1) Try Direct Google GenAI API first (Fastest, zero proxy latency)
    try {
      const directWavBuffer = await generateDirectGoogleTts(text, voice, prompt);
      if (directWavBuffer && directWavBuffer.length > 0) {
        const base64Audio = directWavBuffer.toString("base64");
        return res.json({ audioContent: base64Audio, mimeType: 'audio/wav', provider: 'google', voice });
      }
    } catch (googleErr: any) {
      console.warn("[TTS] Direct Google GenAI call failed, falling back to Replicate:", googleErr?.message || googleErr);
    }

    // 2) Fallback to Replicate
    console.log("[TTS] Calling Gemini TTS on Replicate fallback with voice:", voice || "default");
    const replicate = new Replicate({
      auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN,
    });

    // https://replicate.com/google/gemini-3.1-flash-tts
    const output: any = await replicate.run(
      "google/gemini-3.1-flash-tts",
      {
        input: {
          text,
          voice,
          prompt,
          language_code: language_code || "en-US",
        },
      }
    );

    let buffer: Buffer;
    if (typeof output === "string") {
      // Old style replicate API returns URL
      const audioResp = await fetch(output);
      const audioArr = await audioResp.arrayBuffer();
      buffer = Buffer.from(audioArr);
    } else if (output && typeof output.arrayBuffer === "function") {
      // Stream or FileOutput object from replicate sdk
      const arr = await output.arrayBuffer();
      buffer = Buffer.from(arr);
    } else if (Array.isArray(output) && typeof output[0] === "string") {
      const audioResp = await fetch(output[0]);
      const audioArr = await audioResp.arrayBuffer();
      buffer = Buffer.from(audioArr);
    } else {
      // Fallback
      const audioResp = await fetch(String(output));
      const audioArr = await audioResp.arrayBuffer();
      buffer = Buffer.from(audioArr);
    }

    // Return base64 string matching Google TTS format
    const base64Audio = buffer.toString("base64");
    res.json({ audioContent: base64Audio });

  } catch (err: any) {
    console.error("generateReplicateTtsAudio Error:", err);
    res.status(500).json({ error: err.message });
  }
};
