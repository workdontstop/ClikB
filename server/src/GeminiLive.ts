import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  checkMeteredZeroBalanceGuard,
  getRememberedSessionConversationProfile,
  verifyConversationSessionOwnership,
} from "./aiUsageLedger";
import {
  extractConversationPolicyVersion,
  isPaidConversationProfile,
  resolveAdmittedConversationProfile,
  resolveConversationProfile,
} from "./conversationModels";
import { authenticatedOwnerId, authenticatedUserId } from "./requestAuth";
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
 * session without ever seeing GOOGLE_LIVE_KEY. Bare auth token — the session
 * config (system instruction, tools, audio) is set client-side at connect().
 */
export const GptLiveToken = async (
  req: Request,
  res: Response
): Promise<any> => {
  const sessionScopeId = String(
    req.headers?.["x-clikb-conversation-session"] || req.body?.sessionId || "default"
  ).trim().slice(0, 120) || "default";
  const authedUserId = authenticatedUserId(req);
  if (authedUserId && !verifyConversationSessionOwnership(sessionScopeId, authedUserId)) {
    return res.status(403).send({ message: "This conversation session belongs to another member." });
  }
  const explicitTier = req.body?.conversationModel;
  const rememberedTier = getRememberedSessionConversationProfile(sessionScopeId, authedUserId || undefined);
  const candidateProfile = resolveConversationProfile(explicitTier || rememberedTier || "luna");
  if (candidateProfile && isPaidConversationProfile(candidateProfile.tier) && !authedUserId) {
    return res.status(401).send({ message: "Your session has expired. Please sign in again." });
  }
  const admittedProfile = explicitTier
    ? resolveAdmittedConversationProfile(explicitTier, {
        policyVersion: extractConversationPolicyVersion(req),
      })
    : resolveConversationProfile(rememberedTier || "luna");
  if (admittedProfile && isPaidConversationProfile(admittedProfile.tier)) {
    if (!authedUserId) {
      return res.status(401).send({ message: "Your session has expired. Please sign in again." });
    }
    const guard = await checkMeteredZeroBalanceGuard(authenticatedOwnerId(req)!, 1);
    if (!guard.allowed) {
      return res.status(402).send({
        message: "Not enough pixels for paid Concierge voice.",
        pixels: guard.balance,
        required: 1,
        zeroBalanceReached: true,
      });
    }
    // Paid speech stays behind the authenticated server proxy. Legacy clients
    // must not obtain an unmetered direct token after selecting a paid tier.
    return res.send({ proxyPath: "/geminiSttStream", model: LIVE_MODEL,
      sttModel: LIVE_STT_MODEL, ttsModel: LIVE_TTS_MODEL });
  }

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
