import { Request, Response, Router } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  CreateJobCommandInput,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

/* --------------------------------------------------------------------------
 * MediaConvert client â€“ relies on AWS default credential chain   CodecLevel: "AUTO",
 * ------------------------------------------------------------------------ */
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: "https://q25wbt2lc.mediaconvert.us-east-1.amazonaws.com",
}); //

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */
function toTimecode(secondsTotal: number, fps = 30): string {
  const hours = Math.floor(secondsTotal / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = Math.floor(secondsTotal % 60);
  const fractional = secondsTotal - Math.floor(secondsTotal);
  const frames = Math.floor(fractional * fps);
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
    String(frames).padStart(2, "0"),
  ].join(":");
}

/** Return last path segment without extension or query string */
function stemFromUrl(url: string): string {
  const lastSegment = url.split(/[?#]/)[0].split("/").pop() || "output";
  return lastSegment.replace(/\.[^.]+$/, ""); // strip extension
}

/* --------------------------------------------------------------------------
 * 1) createSlideshow route
 * ------------------------------------------------------------------------ */
export async function createSlideshow(req: Request, res: Response) {
  try {
    const {
      audioUrl,
      audioDuration = 54, // always 20 s in your case
      imageUrls,
      outputResolution,
      outputBucket,
    } = req.body;

    /* ---------- Basic validation ---------- */
    if (
      !audioUrl ||
      !audioDuration ||
      !imageUrls ||
      !outputResolution ||
      !outputBucket
    ) {
      return res.status(400).json({
        error:
          "Missing one of: audioUrl, audioDuration, imageUrls[], outputResolution, outputBucket",
      });
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res
        .status(400)
        .json({ error: "imageUrls must be a non-empty array" });
    }
    const [width, height] = outputResolution.split("x").map(Number);
    if (!width || !height) {
      return res.status(400).json({ error: "Invalid outputResolution format" });
    }

    /* ------------------------------------------------------------------------
     * Compute IMAGE_DURATION_SEC based on how many images:
     * - 2 images â†’ 7 s each (total 14 s)
     * - 3 images â†’ 6 s each (total 18 s)
     * - 4 images â†’ 5 s each (total 20 s)
     * Otherwise, split 20 s evenly.
     * ---------------------------------------------------------------------- */
    let IMAGE_DURATION_SEC: number;
    console.log("jjbb", imageUrls.length);
    switch (imageUrls.length) {
      case 2:
        IMAGE_DURATION_SEC = 7;
        break;
      case 3:
        IMAGE_DURATION_SEC = 6;
        break;
      case 4:
        IMAGE_DURATION_SEC = 6;
        break;
      default:
        // 5+ images â†’ always 5 seconds each
        IMAGE_DURATION_SEC = 6;
        break;
    }

    const videoDurationSec = IMAGE_DURATION_SEC * imageUrls.length;
    const fullAudioLoops = Math.floor(videoDurationSec / audioDuration);
    const audioRemainderSec = videoDurationSec % audioDuration;

    /* ---------- Build Inputs (audio) ---------- */
    const inputs: any[] = [];
    for (let i = 0; i < fullAudioLoops; i++) {
      inputs.push({
        FileInput: audioUrl,
        TimecodeSource: "ZEROBASED",
        AudioSelectors: { "Audio Selector 1": { DefaultSelection: "DEFAULT" } },
      });
    }
    if (audioRemainderSec > 0) {
      inputs.push({
        FileInput: audioUrl,
        TimecodeSource: "ZEROBASED",
        AudioSelectors: { "Audio Selector 1": { DefaultSelection: "DEFAULT" } },
        InputClippings: [{ EndTimecode: toTimecode(audioRemainderSec, 30) }],
      });
    }

    /* ---------- Image overlays ---------- */
    const insertableOverlays: any[] = [];
    const FADE_IN_MS = 1000;
    const FADE_OUT_MS = 1000;
    imageUrls.forEach((imagePath: string, idx: number) => {
      const startTimeSec = idx * IMAGE_DURATION_SEC;
      insertableOverlays.push({
        ImageInserterInput: imagePath,
        Layer: idx,
        Opacity: 100,
        FadeIn: FADE_IN_MS,
        FadeOut: FADE_OUT_MS,
        StartTime: toTimecode(startTimeSec, 30),
        Duration: IMAGE_DURATION_SEC * 1000,
        ImageX: 0,
        ImageY: 0,
        Width: width,
        Height: height,
      });
    });

    /* ---------- Unique output name (based on audio file) ---------- */
    const uniqueId = randomUUID();
    const baseNameOriginal = stemFromUrl(audioUrl);
    const nameModifier = `_${uniqueId}`;
    const finalFileStem = `${baseNameOriginal}${nameModifier}`;

    /* ---------- MediaConvert job ---------- */
    const jobParams: CreateJobCommandInput = {
      Role: "arn:aws:iam::469269069267:role/MediaConvertRole", // your IAM role
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" },
        Inputs: inputs,
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: { Destination: outputBucket },
            },
            Outputs: [
              {
                NameModifier: nameModifier,
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
                      RateControlMode: "CBR",
                      Bitrate: 4_500_000,
                      FramerateControl: "SPECIFIED",
                      FramerateNumerator: 24_000,
                      FramerateDenominator: 1001,
                      GopSize: 48,
                      GopBReference: "DISABLED",
                      CodecProfile: "HIGH",
                      CodecLevel: "AUTO",
                      NumberBFramesBetweenReferenceFrames: 3,
                      AdaptiveQuantization: "HIGH",
                      EntropyEncoding: "CABAC",
                      SceneChangeDetect: "ENABLED",
                    },
                  },
                  VideoPreprocessors: {
                    ImageInserter: { InsertableImages: insertableOverlays },
                  },
                },
                AudioDescriptions: [
                  {
                    AudioSourceName: "Audio Selector 1",
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 128_000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48_000,
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const createResponse = await mediaConvertClient.send(
      new CreateJobCommand(jobParams)
    );
    console.log("MediaConvert job created:", createResponse.Job?.Id);

    /* ---------- Build public URL ---------- */
    const region = process.env.AWS_REGION || "us-east-1";
    let finalVideoUrl: string;
    if (outputBucket.startsWith("s3://")) {
      const noScheme = outputBucket.replace(/^s3:\/\//, "").replace(/\/$/, "");
      const firstSlash = noScheme.indexOf("/");
      const bucket =
        firstSlash === -1 ? noScheme : noScheme.slice(0, firstSlash);
      const prefix = firstSlash === -1 ? "" : noScheme.slice(firstSlash + 1);
      finalVideoUrl = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/${finalFileStem}.mp4`;
    } else {
      finalVideoUrl = `${outputBucket.replace(/\/$/, "")}/${finalFileStem}.mp4`;
    }

    const videoLengthSec = IMAGE_DURATION_SEC * imageUrls.length;
    // (equivalently) const videoLengthSec = fullAudioLoops * audioDuration + audioRemainderSec;

    return res.json({
      message: "MediaConvert job submitted successfully",
      jobId: createResponse.Job?.Id,
      job: createResponse.Job,
      videoUrl: finalVideoUrl,
      videoLength: videoLengthSec, // Added video length here
    });
  } catch (error: any) {
    console.error("Error creating MediaConvert job:", error);
    return res.status(500).json({ error: error.message });
  }
}

/* --------------------------------------------------------------------------
 * 2) getJobStatus route
 * ------------------------------------------------------------------------ */
export async function getJobStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId parameter" });
    }

    const responseJob = await mediaConvertClient.send(
      new GetJobCommand({ Id: jobId })
    );

    return res.json({ status: responseJob.Job?.Status });
  } catch (error: any) {
    console.error("Error getting MediaConvert job status:", error);
    return res.status(500).json({ error: error.message });
  }
}

/* --------------------------------------------------------------------------
 * 3) Router
 * ------------------------------------------------------------------------ */
const router: any = Router();
router.post("/create-memeimg", createSlideshow);
router.get("/job-status/:jobId", getJobStatus);

export default router;
