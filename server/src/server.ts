import express from "express";
//import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

import cors from "cors";
import path from "path";

import cookieParser from "cookie-parser";
import {
  fluxDevRoute,
  sdxlDevRoute,
  fluxProRoute,
  sdxlProRoute,
  wanAnimateRoute,
  wanAnimateRouteRep,
  Seedance2,
  klingProRoute,
  minimax23Route,
  KlingRouteo1,
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
  KontextRoute,
  KontextRouteM,
  MinimaxImageRoute,
  MinimaxImageRoute2,
  seeDream,
  transcribeMiniRoute,
  veo3fast,
  sora2,
  omniHuman,
  wan25FastRoute,
  pollVideoStatus,
  dreamActorRoute,
  lipsync2Pro,
} from "./fluxSchnellRoute"; // <-- the new route

import { upscaleImageRoute } from "./UpscaleRoute";
import { generateReplicateTtsAudio } from "./replicateTtsRoute";
import { samSegmentRoute } from "./samRoute"; // <-- Option 1.5 SAM Route

import { handleStripeWebhook } from "./stripeWebhook"; // ðŸ‘ˆ ADD THIS LINE

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
  fantoggle,
  SaveMusic,
  getFeedsStory,
  getFeedsMoreStory,
  getProfile,
  getProfileMore,
  AudioDb,
  Thumb,
  Cap,
  VideoDb,
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
  addpixels,
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
  getAllWorldsWithCharacters,
  createCharacter,
  createTemplatePrompt,
  getTemplatesPrompt,
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
  GptVideoVisualMiniMax,
  GptBrainstorm,
  GptBrainstormStream,
  GptDistillTemplate,
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
import { voiceTtsStreamRoute } from "./VoiceTts";
import { attachXaiSttProxy, sttProviderRoute } from "./XaiStt";
import { SummarizeBrainstormMemorySlot } from "./MemoryApi";

const app = express();

// 1. ADD THE WEBHOOK ROUTE HERE, BEFORE ANY JSON PARSING MIDDLEWARE
// This route uses a raw body parser, as required by Stripe for signature validation.
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Middleware to handle JSON requests
// 1ï¸âƒ£ Donâ€™t give stripe-webhook requests to express.json():
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
    optionsSuccessStatus: 200,
  };
}

app.use(cors(corsOptions)); // Apply CORS
app.options("*", cors(corsOptions)); // Optional but safe

app.use(cookieParser()); // Use the cookie-parser middleware

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
app.post("/create_template_prompt", createTemplatePrompt);
app.get("/get_templates_prompt", getTemplatesPrompt);

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

app.post("/PostStory", PostStory);

app.post("/fantoggle", fantoggle);

app.post("/savemusic", SaveMusic);

app.post("/callmusic", callmusic);

app.use("/checkIsLogged", loginHandler);

app.use("/RegGoogle", registerHandlerGoogle);

app.use("/checkIsLoggedGoogle", loginHandlerGoogle);

app.post("/startBrainstorm", GptBrainstorm);
app.post("/startBrainstormStream", GptBrainstormStream);
app.post("/distillTemplate", GptDistillTemplate);
app.post("/liveToken", GptLiveToken);
app.get("/sttProvider", sttProviderRoute);
app.post("/voiceTtsStream", voiceTtsStreamRoute);
app.post("/memory/summarizeSlot", SummarizeBrainstormMemorySlot);

app.use("/logout", logoutHandler);

// Milo Verse Routes
app.post("/startMiloCharacters", GptMiloCharacters);
app.post("/startMiloImagePlan", GptMiloImagePlan);
app.post("/startMiloScenes", GptMiloScenes);
app.post("/startMiloVideoPlan", GptMiloVideoPlan);
app.post("/startMiloMotionPrompts", GptMiloMotionPrompts);

app.post("/startStory", GptVisualize);

app.post("/GptVideoVisualMiniMax", GptVideoVisualMiniMax);

app.post("/startMemes", GptMeme);

app.post("/api/segment", samSegmentRoute); // <-- SAM backend route for Shape-Perfect Hotspots

app.post("/startInteractions", GptInt);

app.post("/examplestory", examplestory);

app.post("/startPlan", GptPlan);

app.post("/narrateSummary", narrateSummary);

app.post("/startPlanVid", GptVideoPlan);

app.post("/startPlanK", GptPlanK);

app.post("/startPlanYou", GptYouTubeMeta);

app.post("/extractCasting", GptExtractCasting);

app.post("/generateCastingPrompts", GptGenerateCastingPrompts);

app.post("/GptTagger", GptTagger);

app.post("/EditGeneratedVisualTextOnly", EditGeneratedVisualTextOnly);

app.post("/injectCharactersToPrompt", GptInjectCharacters);

///EditGeneratedVisualTextOnlypp

app.put("/InsertPostSearch", InsertPostSearch);

app.post("/startDesignYou", GptYouTubeDesign);

app.post("/startDesignYouK", GptYou);

app.post("/GptRemake", GptRecreate);
app.post("/GptRemakeSafe", GptRecreateSafe);

app.post("/GptRemake", GptRecreateKontext);
app.post("/GptRemakeKSafe", GptRecreateKontextSafe);

app.post("/GptRemakeText", GptRecreateText);

app.post("/generate-world-remix", GenerateWorldRemix);

app.post("/gptWorldImage", gptWorldImage);

app.post("/ImageDesignStory", GptTextVisual);

app.post("/ImageDesignStoryStageKontext", GptTextVisualKontextStages);
app.post("/ImageDesignStoryStage", GptTextVisualStages);

app.post("/ImageDesignStoryKontext", GptTextVisualKontext);

app.post("/VideoDesign", GptVideoVisual);

app.post("/GptVisualKling3", GptVideoVisualKling3);

app.post("/GptVisualKling3A", GptVideoVisualKling3Audio);

app.post("/VideoDesignveo", GptVideoVisualVeo);

app.post("/VideoDesignSora", GptVideoVisualSora);

app.post("/VideoDesignx", GptV);

app.post("/ChatGPTApiDesign4", GptApi);

app.post("/summary", GptApiSum);

app.post("/ChatGPTApiAudio", GptApiAudio);

app.post("/del-image", DelCloudImage);

app.post("/del-video", DelCloudVideo);

app.post("/del-audio", DelCloudAudio);

app.post("/delPost", deletePost);

app.put("/delPostnobg", deletePostnobg);

app.post("/get_signed_url_image", SignedUrl);

app.post("/get_signed_url_video", SignedUrlVideo);

// === Our new route for flux-schnell
app.post("/fluxDev", fluxDevRoute);

app.post("/seeDream", seeDream);

app.post("/transcribeMiniRoute", transcribeMiniRoute);

app.post("/veo3fast", veo3fast);

app.post("/minimax23Routex", minimax23Routex);

app.post("/sora2", sora2);

app.post("/wan25FastRoute", wan25FastRoute);

// POST /klingPro
app.post("/klingPro", klingProRoute);

// POST /omniHuman â€” bytedance/omni-human-1.5 (audio-driven lip-sync)
app.post("/omniHuman", omniHuman);

app.post("/lipsync2Pro", lipsync2Pro);

app.post("/wanAnimateRoute", wanAnimateRoute);

app.post("/dreamActorRoute", dreamActorRoute);

app.post("/wanAnimateRouteRep", wanAnimateRouteRep);

app.post("/Seedance2", Seedance2);

app.post("/minimax23Route", minimax23Route);

app.post("/KlingRouteo1", KlingRouteo1);

app.post("/pollVideoStatus", pollVideoStatus);

app.post("/klingProL", klingProRouteLite);

app.post("/sdxlReplicate", sdxlDevRoute);

app.post("/fluxPro", fluxProRoute);

app.post("/saveInteractiveVideo", saveInteractiveVideo);

app.post("/fluxschnell", fluxschnellRoutex);

app.post("/fluxUltra", fluxUltra);

app.post("/fluxUltra2", fluxUltra2);

app.post("/HiDream", hiDreamFastRoute);

app.post("/GptImage", GptImageRoute);

app.post("/Ideogram", IdeogramRoute);

app.post("/minimax", MinimaxImageRoute);

app.post("/minimax2", MinimaxImageRoute2);

app.post("/Imagen", ImagenRoute);

app.post("/Imagen2", ImagenRouteOld);

app.post("/Imagenx", ImagenRoutex);

app.post("/kontext", KontextRoute);

app.post("/kontextM", KontextRouteM);

app.post("/Bannana", BanannaRoute);

app.post("/Bannana2", BanannaRouteOld);

app.post("/sdxlReplicatePro", sdxlProRoute);

app.post("/get_signed_url_imageStory", SignedUrlStory);

app.post("/get_signed_url_audioStory", SignedUrlAudio);

app.post("/get_signed_url_audioStoryx", SignedUrlAudiox);

app.post("/get_signed_delete_url_video", SignedDeleteUrlVideo);

app.put("/UpdatePostAudioMp4", AudioDb);

app.put("/addpixels", addpixels);

app.post("/getPixels", getPixels);

app.post("/spendPixels", spendPixels);

app.get("/get_templates_prompt", getTemplatesPrompt);
app.post("/upload_rag_instruction", uploadRagInstruction);
app.get("/get_rag_instructions", getRagInstructions);
app.post("/delete_rag_instruction", deleteRagInstruction);
app.post("/delete_template_prompt", deleteTemplatePrompt);

app.get("/api/get-artstyle-images", getArtstyleImages);
app.post("/api/save-artstyle-image", saveArtstyleImage);
app.post("/GptArtstylePrompt", GptArtstylePrompt);

app.post("/create-checkout-session", createCheckoutSession);

app.put("/UpdatePostThumb", Thumb);

app.post("/upscaleImage", upscaleImageRoute);
app.post("/generateReplicateAudio", generateReplicateTtsAudio);

app.put("/UpdatePostCaption", Cap);

app.put("/UpdatePostAIVideo", VideoDb);
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

app.use("/", trimVideoRouter); // âœ… a Router

app.use("/", trimAudioRouter); // âœ… a Router

if (process.env.APP_STATE === "prod") {
  // Serve static files from dist/frontend
  const distPath = path.join(__dirname, "../../", "dist", "frontend");

  app.use(express.static(distPath));

  // Serve index.html for any other routes
  app.get("*", (_, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start the server on port 5000
const PORT = 8080;
const httpServer = app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
  console.log(`Mode: ${process.env.APP_STATE}`);
});
// xAI streaming STT WebSocket proxy (active only when VOICE_STT_PROVIDER=xai).
attachXaiSttProxy(httpServer);
///server.timeout = 900000; // 15 minutes in milliseconds
