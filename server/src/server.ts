import { scenePresetRoute } from './scenePresetRoutes';
import { pauseLiveBuild, stopLiveBuild, liveBuildEvents, recentLiveBuilds, renderedLiveFeedback } from './liveSceneBuilds';
import express from "express";
//import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

import cors from "cors";
import path from "path";

import cookieParser from "cookie-parser";
import {
  aiUsageContextMiddleware,
  buildMeteredSessionKey,
  getRememberedSessionConversationProfile,
  readMeteredSessionReceipts,
  settleMeteredSession,
  verifyConversationSessionOwnership,
  withFixedAiPixelCharge,
} from "./aiUsageLedger";
import {
  extractConversationPolicyVersion,
  isPaidConversationProfile,
  resolveAdmittedConversationProfile,
  resolveConversationProfile,
} from "./conversationModels";
import { spatialHelperPrice } from './spatialHelperPricing';
import { authenticatedOwnerId, authenticatedUserId, requireAuthenticatedRequest } from "./requestAuth";
import { saveAppAccentColor } from "./AppAccentRoutes";
import { saveMemberDeckEnabled } from './AppDeckRoutes';
import { listImageModelExampleSets, saveImageModelExampleSet, deleteImageModelExampleSet, requireExampleDeveloper } from './ImageModelExampleRoutes';
import { scopeBrainstormMemoryRequest } from "./brainstormMemoryScope";
import { withMediaBilling, withMediaPollBilling } from "./mediaBilling";
import { textGenerationRoutingMiddleware, getOpenAiAvailability, resetOpenAiAvailability } from "./textGeneration";
import { createPublicCrawlerRouter } from "./PublicCrawler";
import { readGuestPublicPosts, readGuestPostIds } from "./PostDatabase";
import { buildMotionGuide } from "./MotionGuideRoute";
import {
  fluxDevRoute,
  sdxlDevRoute,
  fluxProRoute,
  sdxlProRoute,
  wanAnimateRoute,
  wanAnimateRouteRep,
  Seedance2,
  flux3Video,
  flux3VideoFast,
  klingProRoute,
  minimax23Route,
  minimax23Routex,
  klingProRouteLite,
  fluxschnellRoutex,
  fluxUltra,
  fluxUltra2,
  hiDreamFastRoute,
  GptImageRoute,
  IdeogramRoute,
  ImagenRoutex,
  ImagenRoute,
  ImagenRouteOld,
  BanannaRoute,
  BanannaRouteOld,
  MinimaxImageRoute,
  MinimaxImageRoute2,
  seeDream,
  transcribeMiniRoute,
  veo3fast,
  sora2,
  seedance2Mini,
  wan25FastRoute,
  omniHuman,
  pollVideoStatus,
  dreamActorRoute,
  lipsync2Pro,
  safetyVideoDepthRoute,
} from "./fluxSchnellRoute"; // <-- the new route
import { MiniMaxH3Route } from "./minimaxH3Route";
import { FalH3Route } from './falH3Route';
import { geminiOmniFlash } from "./geminiOmniRoute";
import {
  convertModalGpuTime,
  generateModalGpuVideo,
  getModalGpuGenerationStatus,
  getModalGpuStatus,
  getModalGpuTime,
  startModalGpu,
  stopModalGpu,
} from "./gpuControlRoute";

import { upscaleImageRoute, upscaleVideoRoute, denoiseImageRoute, validateVideoUpscaleResolution } from "./UpscaleRoute";
import { generateReplicateTtsAudio } from "./replicateTtsRoute";
import { registerCreationDraftRoutes } from './creationDrafts/routes';
import { registerSocialChatRoutes } from './SocialChatRoutes';
import { attachSocialChatSocket } from './SocialChatSocket';
import { registerCreativeProfileRoutes, validateCreativeProfileSession } from './CreativeProfileRoutes';
import { registerProfileImageRoutes } from './ProfileImageRoutes';
import { samSegmentRoute } from "./samRoute"; // <-- Option 1.5 SAM Route
import { preciseImageQuote, preciseImageRoute, validatePreciseImage } from './preciseImageRoute';
import { reconcilePreciseImagePrompt } from './precisePromptRoute';

import { handleStripeWebhook } from "./stripeWebhook"; // 👈 ADD THIS LINE

import { createCheckoutSession } from "./stripeCheckout"; // adjust path

import mediaRoutes from "./MediaConvertRoutes";

import mediaRoutesD from "./MediaConvertRoutesDirect";

import mediaRoutesDnoaudio from "./MediaConvertRoutesDirectnoaudio";

import mediaRoutesnoaudio from "./MediaConvertRoutesnoaudio";

import mediaRoutesx from "./MediaConvertRoutesImg";

import mediaRoutesxMeme from "./MediaConvertRoutesImgMeme";

import mediaRoutesxMemeVid from "./MediaConvertRoutesVideoMeme";

import trimVideoRouter from "./MediaConvertRoutesTrimVid";

import trimAudioRouter from "./AudioMediaConvertRoutesTrim";

import mediaMusic from "./addBackgroundMusic";
import safetyMediaRouter from "./safetyMediaRoutes";
import lambdaFfmpegRoutes from "./LambdaFfmpegRoutes";

///import { createVideo } from "./MediaConvertRoutes"; // adjust the path as needed

import {
  loginHandlerGoogle,
  loginHandler,
  logoutHandler,
  registerHandlerGoogle,
} from "./LogRoutes";

import {
  SignedUrl,
  SignedUrlStory,
  SignedUrlAudio,
  SignedUrlVideo,
  SignedDeleteUrlVideo,
  DelCloudImage,
  DelCloudVideo,
  DelCloudAudio,
  SignedUrlAudiox,
  DownloadImageForClient,
  NormalizeImageToS3,
} from "./S3Routes";

import {
  billPic,
  ProfilePic,
  PostImage,
  getFeeds,
  getSearch,
  getSearchMore,
  getFeedsMore,
  PostStory,
  UpdateIntentBlueprint,
  SaveSpatialExperience,
  fantoggle,
  SaveMusic,
  DeleteMusic,
  getFeedsStory,
  getFeedsMoreStory,
  getProfile,
  getProfileMore,
  AudioDb,
  Thumb,
  Cap,
  VideoDb,
  SavedVideoUpscales,
  ImageDb,
  BShotTruthDb,
  profileInfo,
  saveInteractiveVideo,
  getFeedClik,
  getFeedClikmore,
  callmusic,
  deletePost,
  deletePostnobg,
  InsertPostSearch,
  getPixels,
  spendPixels,
  getFeedsMoreFeeds,
  getFeedsFeeds,
  interactionSave,
  audioSave,
  fanList,
  likesList,
  fanpeople,
  fanStatus,
  addLikes,
  createWorldModel,
  deleteWorldModel,
  getAllWorldsWithCharacters,
  createCharacter,
  createTemplatePrompt,
  updateTemplateImagePrompt,
  updateTemplateDetails,
  toggleTemplateLibraryPrompt,
  getTemplatesPrompt,
  getShowcaseTemplatesPrompt,
  updateTemplateShowcase,
  getPostSpatial,
  uploadRagInstruction,
  getRagInstructions,
  deleteRagInstruction,
  deleteTemplatePrompt,
  getArtstyleImages,
  saveArtstyleImage,
} from "./PostDatabase";

import {
  GptApi,
  GptVideoPlan,
  GptVisualize,
  GptMeme,
  GptInt,
  GptTextVisual,
  GptTextVisualStages,
  GptTextVisualKontextStages,
  GptTextVisualKontext,
  GptVideoVisual,
  GptVideoVisualKling3,
  GptVideoVisualKling3Audio,
  GptVideoVisualVeo,
  GptVideoVisualSora,
  GptV,
  GptApiAudio,
  GptApiSum,
  GptRecreateSafe,
  GptRecreateKontextSafe,
  GptRecreate,
  GptRecreateKontext,
  GptRecreateText,
  GenerateWorldRemix,
  gptWorldImage,
  GptPlan,
  narrateSummary,
  GptPlanK,
  GptYouTubeMeta,
  GptTagger,
  GptYouTubeDesign,
  GptYou,
  examplestory,
  EditGeneratedVisualTextOnly,
  GptLipSyncAudioInstructions,
  GptVideoVisualMiniMax,
  GptBrainstorm,
  GptBrainstormStream,
  GptDistillTemplate,
  GptProfileImagePrompt,
  categorizeTemplatePromptHandler,
  GptMiloCharacters,
  GptMiloImagePlan,
  GptMiloScenes,
  GptMiloVideoPlan,
  GptMiloMotionPrompts,
  GptExtractCasting,
  GptGenerateCastingPrompts,
  GptInjectCharacters,
  GptArtstylePrompt,
} from "./GptApi";
import { GptLiveToken } from "./GeminiLive";
import { navigationBrowserReply } from './NavigationBrowserBridge';
import {
  compileIntentBlueprint,
  compileGlobalIntent,
  compileSceneIntentSnapshot,
  reconcileSceneIntent,
} from "./IntentBlueprint";
import { compileSpatialMotionContexts, refineSpatialMovementFromFrame } from "./SpatialMotionContext";
import { spatialWorldPlan } from './SpatialWorldPlanRoute';
import { spatialWorldDocument } from './SpatialWorldRoutes';
import { spatialActionLabels } from './SpatialActionLabels';
import { voiceTtsStreamRoute } from "./VoiceTts";
import { fishVoiceListRoute, generateFishPreviewRoute, saveFishPreviewRoute } from './FishVoicePreviews';
import { attachXaiSttProxy, sttProviderRoute } from "./XaiStt";
import { attachGeminiSttProxy } from "./GeminiStt";
import { startMeteredUsageOutbox } from "./meteredUsageOutbox";
import {
  appendConversationMeasurement,
  conversationMeasurementLogPath,
  conversationMeasurementPricing,
  readConversationMeasurementLedger,
  resetConversationMeasurementSession,
} from "./conversationMeasurementLedger";
import {
  DeleteBrainstormSessionMemoryItem,
  ResetBrainstormSessionMemory,
  SearchBrainstormSessionMemory,
  SummarizeBrainstormMemorySlot,
  SyncBrainstormCreationMemoryCards,
} from "./MemoryApi";

const app = express();

// 1. ADD THE WEBHOOK ROUTE HERE, BEFORE ANY JSON PARSING MIDDLEWARE
// This route uses a raw body parser, as required by Stripe for signature validation.
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Middleware to handle JSON requests
// 1️⃣ Don’t give stripe-webhook requests to express.json():
app.use('/profile-image/upload', express.json({ limit: '12mb' }));
app.use(
  express.json({
    limit: "60mb",
    // no verify() here
  })
);

// CORS Configuration based on environment
let corsOptions;

if (process.env.APP_STATE === "dev") {
  corsOptions = {
    origin: [
      "http://172.20.10.2:5173",
      "http://192.168.0.62:5173",
      "http://172.20.10.2:5173",
      "http://localhost:5173",
      "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions",
      "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions",
    ],
    credentials: true, // access-control-allow-credentials:true
    exposedHeaders: [
      "X-ClikB-Pixels-Charged",
      "X-ClikB-Pixels-Balance",
      "X-ClikB-Billing-Label",
      "X-ClikB-Billing-Stage",
      "X-ClikB-Usage-Summary",
      "X-ClikB-OpenAI-Available",
      "X-ClikB-AI-Notice",
      "X-TTS-Engine", "X-TTS-Model", "X-TTS-Fallback", "X-TTS-Fallback-Voice", "X-Voice",
    ],
    optionsSuccessStatus: 200,
  };
} else {
  corsOptions = {
    origin: [
      "http://192.168.0.62:5173",
      "http://172.20.10.2:5173",
      "http://localhost:5173",
      "https://clikb.com",
      "https://www.clikb.com",
      "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions",
      "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions",
    ],
    credentials: true, // access-control-allow-credentials:true
    exposedHeaders: [
      "X-ClikB-Pixels-Charged",
      "X-ClikB-Pixels-Balance",
      "X-ClikB-Billing-Label",
      "X-ClikB-Billing-Stage",
      "X-ClikB-Usage-Summary",
      "X-ClikB-OpenAI-Available",
      "X-ClikB-AI-Notice",
      "X-TTS-Engine", "X-TTS-Model", "X-TTS-Fallback", "X-TTS-Fallback-Voice", "X-Voice",
    ],
    optionsSuccessStatus: 200,
  };
}

app.use(cors(corsOptions)); // Apply CORS
app.options("*", cors(corsOptions)); // Optional but safe

app.use(cookieParser()); // Use the cookie-parser middleware
app.use(validateCreativeProfileSession);
// Bind each request to a temporary usage context returned to the browser.
app.use(aiUsageContextMiddleware);
app.use(textGenerationRoutingMiddleware);

app.get("/ai-provider-status", (_req, res) => {
  res.json(getOpenAiAvailability());
});

app.post("/ai-provider/select-openai", requireAuthenticatedRequest, (_req, res) => {
  resetOpenAiAvailability();
  res.json({ available: true });
});



// Set COOP and COEP Headers, and Set-Cookie for Google Identity
app.use((_, res, next) => {
  res.setHeader("Set-Cookie", "G_ENABLED_IDPS=1; SameSite=None; Secure");

  // Relax COOP and COEP based on environment
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

  next();
});

// Use the checkIsLogged router

app.post("/getFeed", getFeeds);

app.post("/getSearch", getSearch);

app.post("/getSearchMore", getSearchMore);

app.put("/UpdateProfilePic", ProfilePic);

app.put("/UpdateBillboardPic", billPic);

app.put("/interactionSave", interactionSave);

app.put("/audioSave", audioSave);

app.post("/getProfileMore", getProfileMore);

app.post("/getProfile", getProfile);

app.post("/fanList", fanList);

app.post("/likesx", likesList);

app.post("/fanpeople", fanpeople);

app.post("/fanStatus", fanStatus);

app.post("/addlikes", addLikes);

app.post("/create_character", createCharacter);
app.post("/create_world_model", createWorldModel);
app.post("/delete_world_model", deleteWorldModel);
app.post("/create_template_prompt", createTemplatePrompt);
app.post("/update_template_image", updateTemplateImagePrompt);
app.post("/update_template_image_prompt", updateTemplateImagePrompt);
app.post("/update_template_details", updateTemplateDetails);
app.post("/categorize_template_prompt", categorizeTemplatePromptHandler);
app.get("/get_templates_prompt", getTemplatesPrompt);
app.get("/get_showcase_templates_prompt", getShowcaseTemplatesPrompt);
app.post("/update_template_showcase", requireExampleDeveloper, updateTemplateShowcase);
app.post("/getPostSpatial", getPostSpatial);

app.get("/worlds", getAllWorldsWithCharacters);

app.post("/profileInfo", profileInfo);

app.post("/getFeedMore", getFeedsMore);

app.post("/getFeedStory", getFeedsStory);

app.post("/getFeedsclik", getFeedClik);

app.post("/getFeedClikmore", getFeedClikmore);

app.post("/getFeedMoreStory", getFeedsMoreStory);

app.post("/getFeedsMoreFeeds", getFeedsMoreFeeds);

app.post("/getFeedsFeeds", getFeedsFeeds);

app.post("/generatedImagePost", PostImage);

registerCreationDraftRoutes(app);
registerSocialChatRoutes(app);
registerCreativeProfileRoutes(app);
registerProfileImageRoutes(app);
app.post('/profile-image/prompt', GptProfileImagePrompt);

app.post("/PostStory", PostStory);

app.post("/intent-blueprint/save", UpdateIntentBlueprint);
app.put("/spatial-experience/save", SaveSpatialExperience);
app.get("/spatial-experience/action-labels", spatialActionLabels);
app.put("/spatial-experience/action-labels", spatialActionLabels);

app.post("/fantoggle", fantoggle);

app.post("/savemusic", SaveMusic);

app.post("/callmusic", callmusic);

app.post("/deletemusic", DeleteMusic);

app.use("/checkIsLogged", loginHandler);

app.use("/RegGoogle", registerHandlerGoogle);

app.use("/checkIsLoggedGoogle", loginHandlerGoogle);

app.use("/logout", logoutHandler);
app.post("/settings/accent-color", requireAuthenticatedRequest, saveAppAccentColor);
app.post('/settings/deck', requireAuthenticatedRequest, saveMemberDeckEnabled);

// Every state-changing AI/media route registered below this point requires a
// valid signed session cookie. Guest uses the same cookie flow (member 1), so
// this protects paid providers without removing the try-before-sign-up path.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    requireAuthenticatedRequest(req, res, next);
    return;
  }
  next();
});

app.post("/startBrainstorm", scopeBrainstormMemoryRequest, GptBrainstorm);
app.post("/startBrainstormStream", scopeBrainstormMemoryRequest, GptBrainstormStream);
app.get("/conversation-measurement", requireAuthenticatedRequest, async (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim().slice(0, 120);
  const isRawExport = String(req.query.export || "").toLowerCase() === "raw";
  const includeFull = isRawExport || String(req.query.includeRecords || "").toLowerCase() === "full";
  const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
  const ledger = await readConversationMeasurementLedger(sessionId || undefined, { compact: !includeFull, offset, limit });
  const payload = { ledger, pricing: conversationMeasurementPricing, ...(process.env.APP_STATE === "dev" ? { logPath: conversationMeasurementLogPath() } : {}) };
  if (isRawExport) {
    const safeFileSession = (sessionId || "all-sessions").replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="conversation-ledger-${safeFileSession}.json"`);
    res.send(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  res.json(payload);
});
app.post("/conversation-measurement/reset", async (req, res) => {
  const sessionId = String(req.body?.sessionId || "").trim().slice(0, 120);
  if (!sessionId) {
    res.status(400).json({ message: "Missing measurement session id" });
    return;
  }
  await resetConversationMeasurementSession(sessionId);
  res.json({ reset: true, sessionId });
});
app.post("/conversation-measurement/client-record", async (req, res) => {
  const sessionId = String(req.headers["x-clikb-conversation-session"] || "").trim().slice(0, 120);
  const model = String(req.body?.model || "gemini-3.1-flash-live-preview").trim().slice(0, 120);
  const durationSeconds = Math.min(86_400, Math.max(0, Number(req.body?.durationSeconds) || 0));
  if (!sessionId || !durationSeconds) {
    res.status(400).json({ message: "Missing measurement session or duration" });
    return;
  }
  const userId = authenticatedUserId(req);
  if (userId && !verifyConversationSessionOwnership(sessionId, userId)) {
    res.status(403).json({ message: "This conversation session belongs to another member." });
    return;
  }
  const completedAtMs = Date.now();
  const startedAtMs = completedAtMs - Math.round(durationSeconds * 1000);
  const requestId = `client-gemini-stt-${completedAtMs}-${Math.random().toString(36).slice(2, 9)}`;
  const providerCostUsd = durationSeconds / 60 * 0.005;
  appendConversationMeasurement({
    sessionId,
    requestId,
    route: "/gemini-live-stt",
    stage: "conversation",
    actionLabel: "Conversation Speech Recognition (fallback)",
    status: "succeeded",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    elapsedMs: Math.round(durationSeconds * 1000),
    calls: [{
      provider: "google",
      model,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      durationSeconds,
      toolCalls: 0,
      searchCalls: 0,
      providerCostUsd,
      pricingSource: "https://ai.google.dev/gemini-api/docs/pricing",
      usageQuality: "estimated",
      metadata: { source: "browser-direct", basis: "unverified client telemetry", billableToUser: false },
    }],
    events: [{ name: "voice.gemini_stt_closed", at: new Date(completedAtMs).toISOString(), elapsedMs: Math.round(durationSeconds * 1000) }],
  });
  // Browser reports are useful diagnostics, never evidence for wallet debits.
  // Current clients use the server-owned Gemini proxy for authoritative usage.
  res.json({ recorded: true, telemetryOnly: true, meteredBilling: null });
});
app.post("/concierge/metered-settle", async (req, res) => {
  const userId = String(authenticatedUserId(req) || "");
  if (!userId) {
    res.status(401).json({ message: "Please sign in." });
    return;
  }
  if (req.body?.userId !== undefined && req.body?.userId !== null && String(req.body.userId).trim() !== "" && String(req.body.userId).trim() !== userId) {
    res.status(403).json({ message: "You cannot access another member's pixel balance." });
    return;
  }
  const sessionId = String(
    req.body?.sessionId
    || req.headers["x-clikb-conversation-session"]
    || "default"
  ).trim().slice(0, 120) || "default";
  if (!verifyConversationSessionOwnership(sessionId, userId)) {
    res.status(403).json({ message: "This conversation session belongs to another member." });
    return;
  }
  const surface = req.body?.surface === "voice" ? "voice" : "concierge";
  const rememberedTier = getRememberedSessionConversationProfile(sessionId, userId);
  const profile = rememberedTier
    ? resolveConversationProfile(rememberedTier)
    : (req.body?.conversationModel
        ? resolveAdmittedConversationProfile(req.body.conversationModel, {
            policyVersion: extractConversationPolicyVersion(req),
          })
        : null);
  // The test/measurement ID never partitions money or fractional carry.
  const walletId = authenticatedOwnerId(req)!;
  const sessionKey = buildMeteredSessionKey("concierge", walletId, "account");
  const freeTier = !profile || !isPaidConversationProfile(profile.tier);
  // F05: Never trust caller-supplied idempotencyKey; use server-owned deterministic sequence keys.
  const receipt = freeTier ? null : await settleMeteredSession({
    sessionKey,
    userId: walletId,
    surface,
    tier: profile!.tier,
    stage: surface === "voice" ? "tts" : "conversation",
  });
  const afterReceiptSeq = Math.max(0, Math.floor(Number(req.body?.afterReceiptSeq) || 0));
  let receipts;
  try { receipts = await readMeteredSessionReceipts({ sessionKey, userId: walletId, afterReceiptSeq, limit: 100 }); }
  catch {
    res.status(503).json({ message: "Usage receipts are temporarily unavailable; completed work is preserved.",
      sessionKey, pendingReconciliation: true });
    return;
  }
  const latestReceiptSeq = receipts.length ? receipts[receipts.length - 1].receiptSeq : afterReceiptSeq;
  res.json({ freeTier, userId: walletId, sessionKey, receipts, latestReceiptSeq, receipt, meteredBilling: receipt });
});
app.post('/navigation/browser-reply', navigationBrowserReply);
app.post("/distillTemplate", GptDistillTemplate);
app.post("/liveToken", GptLiveToken);
app.get("/sttProvider", sttProviderRoute);
app.post("/voiceTtsStream", voiceTtsStreamRoute);
app.post("/memory/summarizeSlot", scopeBrainstormMemoryRequest, SummarizeBrainstormMemorySlot);
app.post("/memory/session/reset", scopeBrainstormMemoryRequest, ResetBrainstormSessionMemory);
app.post("/memory/session/delete", scopeBrainstormMemoryRequest, DeleteBrainstormSessionMemoryItem);
app.post("/memory/session/search", scopeBrainstormMemoryRequest, SearchBrainstormSessionMemory);
app.post("/memory/session/creation-sync", scopeBrainstormMemoryRequest, SyncBrainstormCreationMemoryCards);

// Milo Verse Routes
app.post("/startMiloCharacters", GptMiloCharacters);
app.post("/startMiloImagePlan", GptMiloImagePlan);
app.post("/startMiloScenes", GptMiloScenes);
app.post("/startMiloVideoPlan", GptMiloVideoPlan);
app.post("/startMiloMotionPrompts", GptMiloMotionPrompts);

app.post("/startStory", withFixedAiPixelCharge(GptVisualize, {
  pixels: 15, stage: "plan", actionLabel: "Story Setup",
}));

app.post("/GptVideoVisualMiniMax", GptVideoVisualMiniMax);

app.post("/startMemes", withFixedAiPixelCharge(GptMeme, {
  pixels: 6, stage: "plan", actionLabel: "Shorts Setup",
}));

app.post("/api/segment", samSegmentRoute); // <-- SAM backend route for Shape-Perfect Hotspots

app.post("/startInteractions", withFixedAiPixelCharge(GptInt, {
  pixels: 15, stage: "plan", actionLabel: "Interaction Setup",
}));

app.post("/examplestory", withFixedAiPixelCharge(examplestory, {
  pixels: 1, stage: "plan", actionLabel: "AI Prompt Idea",
}));

app.post("/startPlan", withFixedAiPixelCharge(GptPlan, {
  pixels: 4, stage: "plan", actionLabel: "Story Plan",
}));

app.post("/intent-blueprint/compile", compileIntentBlueprint);
app.post("/intent-blueprint/compile-global", compileGlobalIntent);
app.post("/intent-blueprint/compile-scene", withFixedAiPixelCharge(compileSceneIntentSnapshot, {
  pixels: 1, stage: "intent", actionLabel: "Scene Intent",
}));

app.post("/intent-blueprint/reconcile-scene", withFixedAiPixelCharge(reconcileSceneIntent, {
  pixels: 1, stage: "intent", actionLabel: "Intent Update",
}));
app.post("/spatial-motion-context/compile", withFixedAiPixelCharge(compileSpatialMotionContexts, {
  pixels: (req) => spatialHelperPrice(req.body?.llmTier),
  stage: "video_prompt", actionLabel: "Motion Context",
}));
app.post('/scene-presets', async (req, res, next) => { try { await scenePresetRoute(req, res); } catch (error) { next(error); } });
app.post('/scene-live/pause', async (req, res, next) => { try { await pauseLiveBuild(req, res); } catch (error) { next(error); } });
app.post('/scene-live/render-feedback', async (req, res, next) => { try { await renderedLiveFeedback(req, res); } catch (error) { next(error); } });
app.post('/scene-live/stop', async (req, res, next) => { try { await stopLiveBuild(req, res); } catch (error) { next(error); } });
app.get('/scene-live/events', async (req, res, next) => { try { await liveBuildEvents(req, res); } catch (error) { next(error); } });
app.get('/scene-live/recent', async (req, res, next) => { try { await recentLiveBuilds(req, res); } catch (error) { next(error); } });
app.post("/motion-guide/build", buildMotionGuide);
app.post('/spatial-world/plan', async (req, res) => { await spatialWorldPlan(req, res); });
app.post('/spatial-world/document', async (req, res) => { await spatialWorldDocument(req, res); });
app.post("/spatial-motion-context/refine-from-frame", withFixedAiPixelCharge(refineSpatialMovementFromFrame, {
  pixels: (req) => spatialHelperPrice(req.body?.llmTier),
  stage: "video_prompt", actionLabel: "Motion Refine",
}));

app.post("/narrateSummary", withFixedAiPixelCharge(narrateSummary, {
  pixels: 1, stage: "ai_edit", actionLabel: "Narration Prompt",
}));

app.post("/startPlanVid", withFixedAiPixelCharge(GptVideoPlan, {
  pixels: 13, stage: "video_prompt", actionLabel: "Video Plan",
}));

app.post("/startPlanK", GptPlanK);

app.post("/startPlanYou", GptYouTubeMeta);

app.post("/extractCasting", withFixedAiPixelCharge(GptExtractCasting, {
  pixels: 4, stage: "plan", actionLabel: (req) => req.body?.auditOnly === true ? "Cast Audit" : "Cast Search",
}));

app.post("/generateCastingPrompts", withFixedAiPixelCharge(GptGenerateCastingPrompts, {
  pixels: 4, stage: "plan", actionLabel: "Reference Prompts",
}));

app.post("/GptTagger", withFixedAiPixelCharge(GptTagger, {
  pixels: 1, stage: "image_prompt", actionLabel: "Prompt Analysis",
}));

app.post("/EditGeneratedVisualTextOnly", withFixedAiPixelCharge(EditGeneratedVisualTextOnly, {
  pixels: 1, stage: "ai_edit", actionLabel: "Visual Text Update",
}));

app.post("/GptLipSyncAudioInstructions", withFixedAiPixelCharge(GptLipSyncAudioInstructions, {
  pixels: (req) => Math.max(1, Math.ceil((Number(req.body?.duration) || 0) / 60 * 2)),
  stage: "transcription", actionLabel: "Lip-Sync Prep",
}));

app.post("/injectCharactersToPrompt", GptInjectCharacters);

///EditGeneratedVisualTextOnlypp

app.put("/InsertPostSearch", InsertPostSearch);

app.post("/startDesignYou", GptYouTubeDesign);

app.post("/startDesignYouK", GptYou);

app.post("/GptRemake", withFixedAiPixelCharge(GptRecreate, {
  pixels: 1, stage: "ai_edit", actionLabel: "Prompt Remake",
}));
app.post("/GptRemakeSafe", withFixedAiPixelCharge(GptRecreateSafe, {
  pixels: 5, stage: "ai_edit", actionLabel: "Safe Remake",
}));

app.post("/GptRemake", GptRecreateKontext);
app.post("/GptRemakeKSafe", GptRecreateKontextSafe);

app.post("/GptRemakeText", withFixedAiPixelCharge(GptRecreateText, {
  pixels: 5, stage: "ai_edit", actionLabel: "Text Remake",
}));

app.post("/generate-world-remix", withFixedAiPixelCharge(GenerateWorldRemix, {
  pixels: 4, stage: "plan", actionLabel: "World Remix Plan",
}));

app.post("/gptWorldImage", gptWorldImage);

app.post("/ImageDesignStory", GptTextVisual);

app.post("/ImageDesignStoryStageKontext", GptTextVisualKontextStages);
app.post("/ImageDesignStoryStage", withFixedAiPixelCharge(GptTextVisualStages, {
  pixels: 1,
  stage: "image_prompt",
  actionLabel: "B-Shot Image Prompt",
  when: (req) => req.body?.isBShotPrompt === true,
}));

app.post("/ImageDesignStoryKontext", GptTextVisualKontext);

app.post("/VideoDesign", GptVideoVisual);

app.post("/GptVisualKling3", GptVideoVisualKling3);

app.post("/GptVisualKling3A", GptVideoVisualKling3Audio);

app.post("/VideoDesignveo", GptVideoVisualVeo);

app.post("/VideoDesignSora", GptVideoVisualSora);

app.post("/VideoDesignx", GptV);

app.post("/ChatGPTApiDesign4", withFixedAiPixelCharge(GptApi, {
  pixels: 1, stage: "image_prompt", actionLabel: "Image Design Prompt",
}));

app.post("/summary", withFixedAiPixelCharge(GptApiSum, {
  pixels: 1, stage: "ai_edit", actionLabel: "Title",
}));

app.post("/ChatGPTApiAudio", withFixedAiPixelCharge(GptApiAudio, {
  pixels: 1, stage: "ai_edit", actionLabel: "Audio Instructions",
}));

app.post("/del-image", DelCloudImage);

app.post("/del-video", DelCloudVideo);

app.post("/del-audio", DelCloudAudio);

app.post("/delPost", deletePost);

app.put("/delPostnobg", deletePostnobg);

app.post("/get_signed_url_image", SignedUrl);

app.post("/get_signed_url_video", SignedUrlVideo);

// === Our new route for flux-schnell
app.post("/fluxDev", withMediaBilling(fluxDevRoute));

app.post("/seeDream", withMediaBilling(seeDream));

app.post("/transcribeMiniRoute", transcribeMiniRoute);

app.post("/veo3fast", withMediaBilling(veo3fast));

app.post("/minimax23Routex", withMediaBilling(minimax23Routex));

app.post("/sora2", withMediaBilling(sora2));

app.post("/seedance2Mini", withMediaBilling(seedance2Mini));

app.post("/wan25FastRoute", withMediaBilling(wan25FastRoute));

// POST /klingPro
app.post("/klingPro", withMediaBilling(klingProRoute));

// POST /omniHuman — bytedance/omni-human-1.5 (audio-driven lip-sync)
app.post("/omniHuman", withMediaBilling(omniHuman));

app.post("/lipsync2Pro", withMediaBilling(lipsync2Pro));

app.post("/wanAnimateRoute", withMediaBilling(wanAnimateRoute));

app.post("/dreamActorRoute", withMediaBilling(dreamActorRoute));

app.post("/wanAnimateRouteRep", withMediaBilling(wanAnimateRouteRep));

app.post("/Seedance2", withMediaBilling(Seedance2));
app.post("/safetyVideoDepth", safetyVideoDepthRoute);

// FLUX 3 (black-forest-labs/flux-3). Two ClikB-facing variants, one shared adapter:
// "Flux" runs full quality, "Flux Fast" runs the draft path.
app.post("/flux3Video", withMediaBilling(flux3Video));

app.post("/flux3VideoFast", withMediaBilling(flux3VideoFast));

// Google Gemini Omni Flash — first frame and character-image references only.
app.post("/geminiOmniFlash", withMediaBilling(geminiOmniFlash));

app.post("/minimax23Route", withMediaBilling(minimax23Route));

app.post("/KlingRouteo1", withMediaBilling(MiniMaxH3Route));
app.post('/falH3', withMediaBilling(FalH3Route));

// Separate Modal GPU controls. These do not replace or modify the FAL MiniMax-H3 route.
app.post("/gpu/modal/start", startModalGpu);
app.get("/gpu/modal/status", requireAuthenticatedRequest, getModalGpuStatus);
app.post("/gpu/modal/stop", stopModalGpu);
app.post("/gpu/modal/generate", generateModalGpuVideo);
app.get("/gpu/modal/generation-status", requireAuthenticatedRequest, getModalGpuGenerationStatus);
app.get("/gpu/modal/time", requireAuthenticatedRequest, getModalGpuTime);
app.post("/gpu/modal/convert-time", convertModalGpuTime);

app.post("/pollVideoStatus", withMediaPollBilling(pollVideoStatus));

app.post("/klingProL", withMediaBilling(klingProRouteLite));

app.post("/sdxlReplicate", withMediaBilling(sdxlDevRoute));

app.post("/fluxPro", withMediaBilling(fluxProRoute));

app.post("/saveInteractiveVideo", saveInteractiveVideo);

app.post("/fluxschnell", withMediaBilling(fluxschnellRoutex));

app.post("/fluxUltra", withMediaBilling(fluxUltra));

app.post("/fluxUltra2", withMediaBilling(fluxUltra2));

app.post("/HiDream", withMediaBilling(hiDreamFastRoute));

app.post("/GptImage", withMediaBilling(GptImageRoute));
app.post("/GptImageFlare", withMediaBilling(GptImageRoute));
app.post("/GptImageSunburst", withMediaBilling(GptImageRoute));

app.post("/Ideogram", withMediaBilling(IdeogramRoute));

app.post("/minimax", withMediaBilling(MinimaxImageRoute));

app.post("/minimax2", withMediaBilling(MinimaxImageRoute2));

app.post("/Imagen", withMediaBilling(ImagenRoute));

app.post("/Imagen2", withMediaBilling(ImagenRouteOld));

app.post("/Imagenx", withMediaBilling(ImagenRoutex));

app.post("/Bannana", withMediaBilling(BanannaRoute));

app.post("/Bannana2", withMediaBilling(BanannaRouteOld));

app.post("/sdxlReplicatePro", withMediaBilling(sdxlProRoute));

app.post("/get_signed_url_imageStory", SignedUrlStory);
app.post("/download-image-for-client", DownloadImageForClient);
app.post("/normalize-image-to-s3", NormalizeImageToS3);

app.post("/get_signed_url_audioStory", SignedUrlAudio);

app.post("/get_signed_url_audioStoryx", SignedUrlAudiox);

app.post("/get_signed_delete_url_video", SignedDeleteUrlVideo);

app.put("/UpdatePostAudioMp4", AudioDb);

app.post("/getPixels", getPixels);

app.post("/spendPixels", spendPixels);

app.get("/get_templates_prompt", getTemplatesPrompt);
app.post("/toggle_template_library", toggleTemplateLibraryPrompt);
app.post("/upload_rag_instruction", uploadRagInstruction);
app.get("/get_rag_instructions", getRagInstructions);
app.post("/delete_rag_instruction", deleteRagInstruction);
app.post("/delete_template_prompt", deleteTemplatePrompt);

app.get("/api/get-artstyle-images", getArtstyleImages);
app.get('/image-model-example-sets', listImageModelExampleSets);
app.post('/image-model-example-sets', requireExampleDeveloper, saveImageModelExampleSet);
app.delete('/image-model-example-sets/:id', requireExampleDeveloper, deleteImageModelExampleSet);
app.post("/api/save-artstyle-image", saveArtstyleImage);
app.post("/GptArtstylePrompt", withFixedAiPixelCharge(GptArtstylePrompt, {
  pixels: 1, stage: "image_prompt", actionLabel: "Art Style Prompt",
}));

app.post("/create-checkout-session", createCheckoutSession);

app.put("/UpdatePostThumb", Thumb);

app.post("/upscaleImage", withMediaBilling(upscaleImageRoute));
app.post('/preciseImage/quote', preciseImageQuote);
app.post('/preciseImage', validatePreciseImage, withMediaBilling(preciseImageRoute));
app.post('/reconcilePreciseImagePrompt', reconcilePreciseImagePrompt);
app.post("/upscaleVideo", validateVideoUpscaleResolution, withMediaBilling(upscaleVideoRoute));
app.post("/denoiseImage", withMediaBilling(denoiseImageRoute));
app.post("/generateReplicateAudio", generateReplicateTtsAudio);
app.get('/api/fish-voices', fishVoiceListRoute);
app.post('/api/fish-voices/generate-preview', generateFishPreviewRoute);
app.post('/api/fish-voices/save-preview', saveFishPreviewRoute);

app.put("/UpdatePostCaption", Cap);

app.put("/UpdatePostAIVideo", VideoDb);
app.get("/SavedVideoUpscales", SavedVideoUpscales);
app.put("/UpdatePostAIImage", ImageDb);
app.put("/UpdatePostBShotTruth", BShotTruthDb);

// Register our media routes
app.use("/", mediaRoutes);

app.use("/", mediaRoutesD);

app.use("/", mediaRoutesDnoaudio);

app.use("/", mediaRoutesnoaudio);

app.use("/", mediaRoutesx);

app.use("/", mediaMusic);

app.use("/", mediaRoutesxMeme);

app.use("/", mediaRoutesxMemeVid);
app.use("/", lambdaFfmpegRoutes);

app.use("/", trimVideoRouter); // ✅ a Router

app.use("/", trimAudioRouter); // ✅ a Router
app.use("/", safetyMediaRouter);

app.use(createPublicCrawlerRouter(readGuestPublicPosts, readGuestPostIds));

if (process.env.APP_STATE === "prod") {
  // Serve static files from dist/frontend
  const distPath = path.join(__dirname, "../../", "dist", "frontend");

  // Account screens are not public search landing pages. Do not block crawling:
  // crawlers need to receive this header to observe the indexing directive.
  app.use(["/settings", "/pages"], (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex");
    next();
  });

  app.use(express.static(distPath, {
    setHeaders(res, file) {
      if (path.basename(file) === "index.html" && res.getHeader("Vary")?.toString().includes("User-Agent")) {
        res.setHeader("Cache-Control", "private, no-store");
      }
    },
  }));

  // Serve index.html for any other routes
  app.get("*", (_, res) => {
    res.sendFile(path.join(distPath, "index.html"), { cacheControl: false });
  });
}

// Start the server on port 5000
const PORT = 8080;
startMeteredUsageOutbox();
const httpServer = app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
  console.log(`Mode: ${process.env.APP_STATE}`);
});
// xAI streaming STT WebSocket proxy (default STT when an xAI key is configured).
attachXaiSttProxy(httpServer);
attachGeminiSttProxy(httpServer);
attachSocialChatSocket(httpServer, corsOptions.origin);
///server.timeout = 900000; // 15 minutes in milliseconds
