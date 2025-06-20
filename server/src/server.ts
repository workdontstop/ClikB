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
  klingProRoute,
  fluxschnellRoutex,
  hiDreamFastRoute,
  GptImageRoute,
  IdeogramRoute,
  ImagenRoute,
} from "./fluxSchnellRoute"; // <-- the new route file

import mediaRoutes from "./MediaConvertRoutes";

import mediaRoutesx from "./MediaConvertRoutesImg";

import mediaRoutesxMeme from "./MediaConvertRoutesImgMeme";

import mediaRoutesxMemeVid from "./MediaConvertRoutesVideoMeme";

import trimVideoRouter from "./MediaConvertRoutesTrimVid";

import trimAudioRouter from "./AudioMediaConvertRoutesTrim";

import mediaMusic from "./addBackgroundMusic";

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
} from "./S3Routes";

import {
  billPic,
  ProfilePic,
  PostImage,
  getFeeds,
  getFeedsMore,
  PostStory,
  SaveMusic,
  getFeedsStory,
  getFeedsMoreStory,
  getProfile,
  getProfileMore,
  AudioDb,
  Thumb,
  Cap,
  VideoDb,
  profileInfo,
  saveInteractiveVideo,
  getFeedClik,
  callmusic,
} from "./PostDatabase";

import {
  GptApi,
  GptVisualize,
  GptMeme,
  GptTextVisual,
  GptVideoVisual,
  GptApiAudio,
  GptApiSum,
  GptRecreate,
  GptRecreateText,
  GptPlan,
  examplestory,
} from "./GptApi";

const app = express();

// Middleware to handle JSON requests
app.use(express.json({ limit: "60mb" })); // or even larger

// CORS Configuration based on environment
let corsOptions;

if (process.env.APP_STATE === "dev") {
  corsOptions = {
    origin: [
      "http://172.20.10.2:5173",
      "http://192.168.1.236:5173",
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
      "http://192.168.1.236:5173",
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

app.put("/UpdateProfilePic", ProfilePic);

app.put("/UpdateBillboardPic", billPic);

app.post("/getProfileMore", getProfileMore);

app.post("/getProfile", getProfile);

app.post("/profileInfo", profileInfo);

app.post("/getFeedMore", getFeedsMore);

app.post("/getFeedStory", getFeedsStory);

app.post("/getFeedClik", getFeedClik);

app.post("/getFeedMoreStory", getFeedsMoreStory);

app.post("/generatedImagePost", PostImage);

app.post("/PostStory", PostStory);

app.post("/savemusic", SaveMusic);

app.post("/callmusic", callmusic);

app.use("/checkIsLogged", loginHandler);

app.use("/RegGoogle", registerHandlerGoogle);

app.use("/checkIsLoggedGoogle", loginHandlerGoogle);

app.use("/logout", logoutHandler);

app.post("/startStory", GptVisualize);

app.post("/startMemes", GptMeme);

app.post("/examplestory", examplestory);

app.post("/startPlan", GptPlan);

app.post("/GptRemake", GptRecreate);

app.post("/GptRemakeText", GptRecreateText);

app.post("/ImageDesignStory", GptTextVisual);

app.post("/VideoDesign", GptVideoVisual);

app.post("/ChatGPTApiDesign4", GptApi);

app.post("/summary", GptApiSum);

app.post("/ChatGPTApiAudio", GptApiAudio);

app.post("/get_signed_url_image", SignedUrl);

app.post("/get_signed_url_video", SignedUrlVideo);

// === Our new route for flux-schnell
app.post("/fluxDev", fluxDevRoute);

// POST /klingPro
app.post("/klingPro", klingProRoute);

app.post("/sdxlReplicate", sdxlDevRoute);

app.post("/fluxPro", fluxProRoute);

app.post("/saveInteractiveVideo", saveInteractiveVideo);

app.post("/fluxschnell", fluxschnellRoutex);

app.post("/HiDream", hiDreamFastRoute);

app.post("/GptImage", GptImageRoute);

app.post("/Ideogram", IdeogramRoute);

app.post("/Imagen", ImagenRoute);

app.post("/sdxlReplicatePro", sdxlProRoute);

app.post("/get_signed_url_imageStory", SignedUrlStory);

app.post("/get_signed_url_audioStory", SignedUrlAudio);

app.post("/get_signed_delete_url_video", SignedDeleteUrlVideo);

app.put("/UpdatePostAudioMp4", AudioDb);

app.put("/UpdatePostThumb", Thumb);

app.put("/UpdatePostCaption", Cap);

app.put("/UpdatePostAIVideo", VideoDb);

// Register our media routes
app.use("/", mediaRoutes);

app.use("/", mediaRoutesx);

app.use("/", mediaMusic);

app.use("/", mediaRoutesxMeme);

app.use("/", mediaRoutesxMemeVid);

app.use("/", trimVideoRouter); // ✅ a Router

app.use("/", trimAudioRouter); // ✅ a Router

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
app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
});
