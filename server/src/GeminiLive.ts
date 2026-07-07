import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const GEMINI_KEY = process.env.GOOGLE_LIVE_KEY;

// Voice mode uses separate Live sessions:
// - STT favors lower latency transcription.
// - TTS stays on the native-audio voice model.
export const LIVE_STT_MODEL = "gemini-3.1-flash-live-preview";
export const LIVE_TTS_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
export const LIVE_MODEL = LIVE_TTS_MODEL;

/**
 * Mints a short-lived ephemeral token so the browser can open a Gemini Live
 * session without ever seeing GOOGLE_LIVE_KEY. Bare auth token â€” the session
 * config (system instruction, tools, audio) is set client-side at connect().
 */
export const GptLiveToken = async (
  _req: Request,
  res: Response
): Promise<any> => {
  console.log("[liveToken] request received; key present:", !!GEMINI_KEY);
  if (!GEMINI_KEY) {
    console.error("[liveToken] GOOGLE_LIVE_KEY is not configured");
    return res.status(500).send({ message: "GOOGLE_LIVE_KEY is not configured" });
  }
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token: any = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    console.log("[liveToken] token minted, sttModel:", LIVE_STT_MODEL, "ttsModel:", LIVE_TTS_MODEL);
    return res.send({
      token: token?.name ?? token,
      model: LIVE_MODEL,
      sttModel: LIVE_STT_MODEL,
      ttsModel: LIVE_TTS_MODEL,
    });
  } catch (e: any) {
    console.error("[GptLiveToken] error:", e?.message);
    return res.status(500).send({ message: "Failed to mint live token", error: e?.message });
  }
};
