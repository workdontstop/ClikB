import { Request, Response, Router } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

dotenv.config();

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT,
});

const OUTPUT_BUCKET =
  process.env.OUTPUT_BUCKET || "s3://clikbatebucket/videos-with-music/";

const MEDIA_CONVERT_ROLE =
  process.env.MEDIA_CONVERT_ROLE ||
  "arn:aws:iam::469269069267:role/MediaConvertRole";

function generateOutputFileName(videoUrlx: string): string {
  const filename = videoUrlx.split("/").pop() || "output.mp4";
  const [base, ext] = filename.split(/\.(?=[^.]+$)/);
  return `${base}_with_music.${ext || "mp4"}`;
}

function secsToTimecodeZeroBased(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}:00`;
}

// POST /addbackgroundmusic
export async function addBackgroundMusicRoute(req: Request, res: Response) {
  try {
    const {
      videoUrlx,
      audioUrlx,
      videoLength,
      outputResolution,
      logo,
      text1,
      type,
      audioLength,
      isVideoSilent, // <--- NEW FLAG: Pass true if video has no audio
      usedanimate,
    } = req.body as {
      videoUrlx: string;
      audioUrlx?: string;
      videoLength: number;
      outputResolution: any;
      logo?: string;
      text1?: string;
      text2?: string;
      type?: number | string;
      audioLength?: number;
      isVideoSilent?: boolean;
      usedanimate?: boolean;
    };

    // 1. Setup Logic Variables
    var BG_DB = Number(type) === 2 ? -13 : -35;
    if (usedanimate) {
      BG_DB = -60;
    }
    const includeBgMusic = Number(type) !== 1;

    // Loop Logic
    const safeAudioLen = audioLength || 90;
    const needsDoubleLoop = includeBgMusic && videoLength > safeAudioLen + 1;

    // Silent Video Check (Defaults to false if not sent)
    const videoHasAudio = isVideoSilent !== true;

    // 2. Validation
    if (
      !videoUrlx ||
      typeof videoLength !== "number" ||
      (!outputResolution && outputResolution !== 0) ||
      (includeBgMusic && !audioUrlx)
    ) {
      return res.status(400).json({
        error: includeBgMusic
          ? "Missing one of: videoUrlx, audioUrlx, videoLength"
          : "Missing one of: videoUrlx, videoLength",
      });
    }

    const [width, height] = String(outputResolution).split("x").map(Number);
    if (!width || !height) {
      return res.status(400).json({ error: "Invalid outputResolution format" });
    }

    console.log(`Processing Video: ${videoUrlx}`);
    console.log(
      `Audio Status: ${videoHasAudio ? "Has Audio" : "Silent (Mute)"}`
    );
    if (includeBgMusic) {
      console.log(
        `Mixing Mode: ${needsDoubleLoop ? "Double Loop" : "Single Loop"}`
      );
    }

    const outputFileName = generateOutputFileName(videoUrlx);
    const destinationFolder = OUTPUT_BUCKET.endsWith("/")
      ? OUTPUT_BUCKET
      : OUTPUT_BUCKET + "/";

    // ----------------------------------------------------------
    // DYNAMIC INPUT & SELECTOR CONFIG
    // ----------------------------------------------------------

    // Start with a clean input object (no hardcoded selectors)
    const input: any = {
      FileInput: videoUrlx,
      VideoSelector: { ColorSpace: "FOLLOW" },
      AudioSelectors: {},
    };

    // A. Add Video Audio Selector (ONLY if video has audio)
    if (videoHasAudio) {
      input.AudioSelectors["Audio Selector 1"] = {
        Tracks: [1],
        DefaultSelection: "DEFAULT",
        SelectorType: "TRACK",
      };
    }

    // B. Add Background Music Selectors
    if (includeBgMusic) {
      // Music Loop 1
      input.AudioSelectors["Audio Selector 2"] = {
        ExternalAudioFileInput: audioUrlx,
        DefaultSelection: "NOT_DEFAULT",
        SelectorType: "TRACK",
        Offset: 0,
      };

      // Music Loop 2 (if needed)
      if (needsDoubleLoop) {
        input.AudioSelectors["Audio Selector 3"] = {
          ExternalAudioFileInput: audioUrlx,
          DefaultSelection: "NOT_DEFAULT",
          SelectorType: "TRACK",
          Offset: safeAudioLen * 1000,
        };
      }

      // Group the active selectors
      const activeSelectors = [];
      if (videoHasAudio) activeSelectors.push("Audio Selector 1");
      activeSelectors.push("Audio Selector 2");
      if (needsDoubleLoop) activeSelectors.push("Audio Selector 3");

      input.AudioSelectorGroups = {
        "Audio Selector Group 1": {
          AudioSelectorNames: activeSelectors,
        },
      };
    }

    // ----------------------------------------------------------
    // DYNAMIC MIXING SETTINGS (The "Check")
    // ----------------------------------------------------------
    let remixSettings: any = {};

    if (includeBgMusic) {
      // We have to shift the channel indexes depending on what exists.
      // If Video exists: Video is Ch [0,1], Music1 is [2,3]
      // If Video is Mute: Music1 is Ch [0,1]

      if (videoHasAudio) {
        if (needsDoubleLoop) {
          // --- CASE 1: AUDIO VIDEO + DOUBLE LOOP (6 Channels) ---
          // 0,1=Video | 2,3=Music1 | 4,5=Music2
          remixSettings = {
            ChannelsIn: 6,
            ChannelsOut: 2,
            ChannelMapping: {
              OutputChannels: [
                { InputChannelsFineTune: [0, -60, BG_DB, -60, BG_DB, -60] },
                { InputChannelsFineTune: [-60, 0, -60, BG_DB, -60, BG_DB] },
              ],
            },
          };
        } else {
          // --- CASE 2: AUDIO VIDEO + SINGLE LOOP (4 Channels) ---
          // 0,1=Video | 2,3=Music1
          remixSettings = {
            ChannelsIn: 4,
            ChannelsOut: 2,
            ChannelMapping: {
              OutputChannels: [
                { InputChannelsFineTune: [0, -60, BG_DB, -60] },
                { InputChannelsFineTune: [-60, 0, -60, BG_DB] },
              ],
            },
          };
        }
      } else {
        // --- CASE 3: SILENT VIDEO (Video audio skipped) ---
        if (needsDoubleLoop) {
          // --- SILENT + DOUBLE LOOP (4 Channels) ---
          // 0,1=Music1 | 2,3=Music2 (Indices shift down because video is gone)
          remixSettings = {
            ChannelsIn: 4,
            ChannelsOut: 2,
            ChannelMapping: {
              OutputChannels: [
                { InputChannelsFineTune: [BG_DB, -60, BG_DB, -60] },
                { InputChannelsFineTune: [-60, BG_DB, -60, BG_DB] },
              ],
            },
          };
        } else {
          // --- SILENT + SINGLE LOOP (2 Channels) ---
          // 0,1=Music1
          remixSettings = {
            ChannelsIn: 2,
            ChannelsOut: 2,
            ChannelMapping: {
              OutputChannels: [
                { InputChannelsFineTune: [BG_DB, -60] },
                { InputChannelsFineTune: [-60, BG_DB] },
              ],
            },
          };
        }
      }
    }

    // Build AudioDescriptions
    const audioDescriptions: any[] = [];

    if (includeBgMusic) {
      audioDescriptions.push({
        AudioSourceName: "Audio Selector Group 1",
        AudioTypeControl: "FOLLOW_INPUT",
        CodecSettings: {
          Codec: "AAC",
          AacSettings: {
            Bitrate: 192000,
            CodingMode: "CODING_MODE_2_0",
            SampleRate: 48000,
          },
        },
        RemixSettings: remixSettings,
      });
    } else {
      // Branding Only Mode
      if (videoHasAudio) {
        audioDescriptions.push({
          AudioSourceName: "Audio Selector 1",
          AudioTypeControl: "FOLLOW_INPUT",
          CodecSettings: {
            Codec: "AAC",
            AacSettings: {
              Bitrate: 192000,
              CodingMode: "CODING_MODE_2_0",
              SampleRate: 48000,
            },
          },
        });
      }
      // If video is silent and no music, we send NO AudioDescriptions (Video only output)
    }

    // ---------- BRANDING LOGIC (Standard) ----------
    const clamp = (min: number, max: number, v: number) =>
      Math.max(min, Math.min(max, v));
    const toEven = (n: number) => (n % 2 ? n - 1 : n);
    const insertableImages: any[] = [];

    if (logo) {
      // (Your existing logo logic here - abbreviated for cleanliness)
      const requested = Number((req.body as any).logoSizePx);
      const ratio = width / height;
      const EPS = 0.01;
      let logoSize = 110;
      if (Number.isFinite(requested) && requested > 0) logoSize = requested;
      else if (Math.abs(ratio - 1) < EPS) logoSize = 90;
      else if (Math.abs(ratio - 9 / 16) < EPS) logoSize = 150;

      const margin = Number((req.body as any).brandMarginPx) || 24;
      const gap = Number((req.body as any).brandGapPx) || 0;
      const logoX = margin;
      const logoY = margin + Math.round(height * 0.10);

      const baseTextH = Number((req.body as any).textHeightPx) || 48;
      let textScale = height > width ? 1.2 : width > height ? 1 : 0.9;
      const textHeight = toEven(
        clamp(16, 720, Math.round(baseTextH * textScale))
      );
      const guessedWidth = Math.round(textHeight * 3.0);
      const textWidth = toEven(clamp(24, width, guessedWidth));

      const textX = logoX + toEven(logoSize) + gap;
      const textY = Math.max(
        margin,
        logoY + Math.round((toEven(logoSize) - textHeight) / 2)
      );
      const totalMs = Math.round(videoLength * 1000);
      const durMs = 10000;
      const maxStart = Math.max(0, totalMs - durMs);
      const randStartMs = Math.floor(Math.random() * (maxStart + 1));
      const startTimecode = secsToTimecodeZeroBased(randStartMs / 1000);

      if (text1) {
        insertableImages.push({
          FadeIn: 200,
          FadeOut: 200,
          Opacity: 100,
          ImageX: textX,
          ImageY: textY,
          Height: textHeight,
          Width: textWidth,
          Layer: 6,
          ImageInserterInput: text1,
          StartTime: startTimecode,
          Duration: durMs,
        });
      }
      insertableImages.push({
        ImageInserterInput: logo,
        StartTime: startTimecode,
        Duration: durMs,
        FadeIn: 180,
        FadeOut: 180,
        Opacity: 100,
        Layer: 5,
        ImageX: logoX,
        ImageY: logoY,
        Height: toEven(logoSize),
        Width: toEven(logoSize),
      });
    }

    // ----------------------------------------------------------

    const jobParams: CreateJobCommandInput = {
      Role: MEDIA_CONVERT_ROLE,
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" },
        Inputs: [input],
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: {
                Destination: destinationFolder,
              },
            },
            Outputs: [
              {
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: { MoovPlacement: "PROGRESSIVE_DOWNLOAD" },
                },
                VideoDescription: {
                  Width: width,
                  Height: height,
                  ScalingBehavior: "DEFAULT",
                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "QVBR",
                      MaxBitrate: 4_500_000,
                      QvbrSettings: { QvbrQualityLevel: 7 },
                      FramerateControl: "INITIALIZE_FROM_SOURCE",
                      GopSize: 48,
                      GopBReference: "DISABLED",
                      CodecProfile: "HIGH",
                    },
                  },
                  ...(insertableImages.length
                    ? {
                        VideoPreprocessors: {
                          ImageInserter: { InsertableImages: insertableImages },
                        },
                      }
                    : {}),
                },
                AudioDescriptions: audioDescriptions.length
                  ? (audioDescriptions as any)
                  : undefined,
                NameModifier: `_${outputFileName
                  .split(".")
                  .slice(0, -1)
                  .join(".")}`,
              },
            ],
          },
        ],
      },
    };

    console.log("Final Job JSON:", JSON.stringify(jobParams, null, 2));

    const command = new CreateJobCommand(jobParams);
    const response = await mediaConvertClient.send(command);
    const jobId = response.Job?.Id;

    const origFilename = videoUrlx.split("/").pop()!;
    const [baseName, ext] = origFilename.split(/\.(?=[^.]+$)/);
    const nameModifier = `_${baseName}_with_music`;
    const finalFileName = `${baseName}${nameModifier}.${ext}`;
    const bucketName = destinationFolder.replace("s3://", "").split("/")[0];
    const prefix = destinationFolder.replace(`s3://${bucketName}/`, "");
    const region = (await mediaConvertClient.config.region()) || "us-east-1";
    const finalUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${prefix}${finalFileName}`;

    return res.json({
      message: "MediaConvert job submitted successfully.",
      jobId,
      outputVideo: finalUrl,
    });
  } catch (err: any) {
    console.error("MediaConvert error:", err);
    if (err.name === "BadRequestException") {
      return res
        .status(400)
        .json({ error: "AWS BadRequest.", details: err.message });
    }
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
}

const router: any = Router();
router.post("/addbackgroundmusic", addBackgroundMusicRoute);
export default router;
