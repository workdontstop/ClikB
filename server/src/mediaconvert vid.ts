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
 * MediaConvert client â€“ uses the same hardcoded-style config you posted
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

/** Return last path segment without extension or query string */
function stemFromUrl(url: string): string {
  const lastSegment = url.split(/[?#]/)[0].split("/").pop() || "output";
  return lastSegment.replace(/\.[^.]+$/, ""); // strip extension
}

/* --------------------------------------------------------------------------
 * createLoopedVideo route (video-only: use native audio from each clip)   CodecLevel: "AUTO",
 * ------------------------------------------------------------------------ */
export async function createLoopedVideo(req: Request, res: Response) {
  try {
    const {
      videoUrls, // N clips; each contributes one 5s segment
      outputResolution, // e.g. "1080x1920"
      outputBucket,
      clipDurations,
    } = req.body;

    /* ---------- validation ---------- */
    if (!videoUrls || !outputResolution || !outputBucket) {
      return res.status(400).json({
        error: "videoUrls[], outputResolution, outputBucket are required",
      });
    }
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res
        .status(400)
        .json({ error: "videoUrls must be a non-empty array" });
    }

    const [width, height] = outputResolution.split("x").map(Number);
    if (!width || !height) {
      return res.status(400).json({ error: "Invalid outputResolution format" });
    }

    /* ---------- timing ---------- */
    const CLIP_LENGTH_SEC = clipDurations;
    const SCENE_LENGTH_SEC = CLIP_LENGTH_SEC; // 5 s per scene (one clip)
    const totalVideoLengthSec = videoUrls.length * SCENE_LENGTH_SEC;

    /* ---------- build Inputs (video + native audio only) ---------- */
    const inputs: any[] = [];

    videoUrls.forEach((videoPath: string) => {
      inputs.push({
        FileInput: videoPath,
        TimecodeSource: "ZEROBASED",
        // ~5.0 s per clip (00:00:00:00 -> 00:00:04:29)
        InputClippings: [
          { StartTimecode: "00:00:00:00", EndTimecode: "00:00:04:29" },
        ],
        // Single selector "native" to grab the clip's embedded audio
        AudioSelectors: {
          native: { DefaultSelection: "DEFAULT" },
        },
      });
    });

    /* ---------- unique output name (stem from first video) ---------- */
    const uniqueId = randomUUID();
    const stem = stemFromUrl(videoUrls[0]);
    const nameModifier = `_${uniqueId}`;

    /* ---------- MediaConvert job ---------- */
    const jobParams: CreateJobCommandInput = {
      Role: "arn:aws:iam::469269069267:role/MediaConvertRole",
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
                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "CBR",
                      Bitrate: 4_500_000,
                      FramerateControl: "SPECIFIED",
                      FramerateNumerator: 24_000,
                      FramerateDenominator: 1001,
                      GopSize: 48,
                      CodecProfile: "HIGH",
                      CodecLevel: "AUTO",
                      NumberBFramesBetweenReferenceFrames: 3,
                      AdaptiveQuantization: "HIGH",
                      EntropyEncoding: "CABAC",
                      SceneChangeDetect: "ENABLED",
                    },
                  },
                },
                // ONE audio track: native audio concatenated across inputs
                AudioDescriptions: [
                  {
                    AudioSourceName: "native",
                    AudioTypeControl: "FOLLOW_INPUT",
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

    /* ---------- build public URL ---------- */
    const region = "us-east-1";
    const noScheme = outputBucket.replace(/^s3:\/\//, "").replace(/\/$/, "");
    const firstSlash = noScheme.indexOf("/");
    const bucket = firstSlash === -1 ? noScheme : noScheme.slice(0, firstSlash);
    const prefix = firstSlash === -1 ? "" : noScheme.slice(firstSlash + 1);
    const finalVideoUrl = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/${stem}${nameModifier}.mp4`;

    return res.json({
      message: "MediaConvert job submitted successfully",
      jobId: createResponse.Job?.Id,
      job: createResponse.Job,
      videoUrl: finalVideoUrl,
      videoLength: totalVideoLengthSec,
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
router.post("/create-memevidm", createLoopedVideo);
router.get("/job-status/:jobId", getJobStatus);

export default router;
