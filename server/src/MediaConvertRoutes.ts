import { Request, Response, Router } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  CreateJobCommandInput,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

dotenv.config();

// MediaConvert client
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: "https://q25wbt2lc.mediaconvert.us-east-1.amazonaws.com",
});

// seconds -> 'HH:MM:SS:FF' at 30 fps (inclusive end frame)
function toTimecode(secondsTotal: number, fps = 30): string {
  const rawTotalFrames = Math.round(secondsTotal * fps);
  const lastFrameIndex = Math.max(rawTotalFrames - 1, 0);

  const framesPerHour = fps * 3600;
  const framesPerMinute = fps * 60;

  const hours = Math.floor(lastFrameIndex / framesPerHour);
  let remainder = lastFrameIndex % framesPerHour;

  const minutes = Math.floor(remainder / framesPerMinute);
  remainder = remainder % framesPerMinute;

  const seconds = Math.floor(remainder / fps);
  const frames = remainder % fps;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
    String(frames).padStart(2, "0"),
  ].join(":");
}

/**
 * createVideo
 *
 * UPDATED behavior (per scene):
 * Phase A (narration section):
 *   - Visuals loop Stage1 then Stage2 then Stage1 then Stage2... to cover narration length
 *   - Audio is ONLY the external narration audio (continuous via Offset)
 *
 * Phase B (showcase section):
 *   - Play ONE full Stage1 clip with embedded audio
 *   - Then ONE full Stage2 clip with embedded audio
 *   - Narration does NOT play here
 *
 * IMPORTANT: videoUrls is ALWAYS DOUBLED: [A1,B1,A2,B2,...]
 */
export async function createVideo(req: Request, res: Response) {
  try {
    const {
      audioUrls, // string[] narration audio (one per scene)
      videoUrls, // string[] ALWAYS DOUBLED: [A1,B1,A2,B2,...]
      audioDurations, // number[] narration length per scene (seconds)
      outputResolution, // "1920x1080"
      outputBucket, // "s3://bucket/path/"
      clipDurations, // number: duration in seconds of EACH AI clip
    } = req.body;

    // ---- basic validation ----
    if (
      !audioUrls ||
      !videoUrls ||
      !audioDurations ||
      !outputResolution ||
      !outputBucket ||
      clipDurations == null
    ) {
      return res.status(400).json({
        error:
          "Missing one of: audioUrls[], videoUrls[], audioDurations[], outputResolution, outputBucket, clipDurations",
      });
    }

    if (
      !Array.isArray(audioUrls) ||
      !Array.isArray(videoUrls) ||
      !Array.isArray(audioDurations)
    ) {
      return res
        .status(400)
        .json({ error: "audioUrls, videoUrls, audioDurations must be arrays" });
    }

    const sceneCount = audioUrls.length;

    if (audioDurations.length !== sceneCount) {
      return res.status(400).json({
        error: "audioUrls and audioDurations must have the same length",
      });
    }

    // âœ… MUST be doubled always: [A1,B1,A2,B2,...]
    if (videoUrls.length !== sceneCount * 2) {
      return res.status(400).json({
        error: `videoUrls must be doubled always: length ${
          sceneCount * 2
        }. Got ${videoUrls.length}`,
      });
    }

    const [width, height] = String(outputResolution).split("x").map(Number);
    if (!width || !height) {
      return res
        .status(400)
        .json({ error: "Invalid outputResolution (use '1920x1080' style)" });
    }

    // ---- clip length validation ----
    const CLIP_LENGTH_SEC = Number(clipDurations);
    if (!Number.isFinite(CLIP_LENGTH_SEC) || CLIP_LENGTH_SEC <= 0) {
      return res
        .status(400)
        .json({ error: "clipDurations must be a positive number (seconds)" });
    }

    const FPS = 30;
    const fullClipEndTc = toTimecode(CLIP_LENGTH_SEC, FPS);

    const inputs: any[] = [];

    // Total runtime = sum( narrationDuration + Stage1 clip + Stage2 clip ) across scenes
    const totalVideoLengthSec = audioDurations.reduce(
      (sum: number, narrLen: any) => {
        const n = Math.max(0, Number(narrLen) || 0);
        return sum + n + 2 * CLIP_LENGTH_SEC;
      },
      0
    );

    for (let i = 0; i < sceneCount; i++) {
      const narrationAudioPath = audioUrls[i];
      const narrLen = Math.max(0, Number(audioDurations[i]) || 0);

      // âœ… Stage 1 / Stage 2 per scene
      const videoA: string = videoUrls[i * 2];
      const videoB: string = videoUrls[i * 2 + 1];

      const pickStageClip = (tileIndex: number) => {
        // A then B then A then B...
        // fallback if one missing
        if (videoA && videoB) return tileIndex % 2 === 0 ? videoA : videoB;
        return videoA || videoB;
      };

      // ----------------------------------
      // Phase A: narration section
      // visuals = A,B,A,B... until narration covered
      // audio = narration only, continuous via Offset
      // ----------------------------------
      const fullTiles = Math.floor(narrLen / CLIP_LENGTH_SEC);
      const leftoverSec = narrLen % CLIP_LENGTH_SEC;

      // full tiles
      for (let t = 0; t < fullTiles; t++) {
        const offsetMs = -(t * CLIP_LENGTH_SEC * 1000);

        inputs.push({
          FileInput: pickStageClip(t),
          TimecodeSource: "ZEROBASED",
          InputClippings: [
            {
              StartTimecode: "00:00:00:00",
              EndTimecode: fullClipEndTc,
            },
          ],
          AudioSelectors: {
            // narration
            "Audio Selector 1": {
              ExternalAudioFileInput: narrationAudioPath,
              Offset: offsetMs,
              DefaultSelection: "DEFAULT",
            },
            // embedded clip audio present but not used in this phase
            "Audio Selector 2": {
              SelectorType: "TRACK",
              Tracks: [1],
              DefaultSelection: "NOT_DEFAULT",
            },
          },
          AudioSelectorGroups: {
            // narration only
            "Audio Selector Group 1": {
              AudioSelectorNames: ["Audio Selector 1"],
            },
          },
        });
      }

      // tail tile
      if (leftoverSec > 0) {
        const offsetMs = -(fullTiles * CLIP_LENGTH_SEC * 1000);

        inputs.push({
          FileInput: pickStageClip(fullTiles),
          TimecodeSource: "ZEROBASED",
          InputClippings: [
            {
              StartTimecode: "00:00:00:00",
              EndTimecode: toTimecode(leftoverSec, FPS),
            },
          ],
          AudioSelectors: {
            "Audio Selector 1": {
              ExternalAudioFileInput: narrationAudioPath,
              Offset: offsetMs,
              DefaultSelection: "DEFAULT",
            },
            "Audio Selector 2": {
              SelectorType: "TRACK",
              Tracks: [1],
              DefaultSelection: "NOT_DEFAULT",
            },
          },
          AudioSelectorGroups: {
            "Audio Selector Group 1": {
              AudioSelectorNames: ["Audio Selector 1"],
            },
          },
        });
      }

      // ----------------------------------
      // Phase B: showcase section
      // play Stage 1 (A) then Stage 2 (B) WITH embedded audio
      // narration should not play here
      // ----------------------------------
      const showcaseClips = [videoA, videoB].filter(Boolean);

      for (let s = 0; s < showcaseClips.length; s++) {
        inputs.push({
          FileInput: showcaseClips[s],
          TimecodeSource: "ZEROBASED",
          InputClippings: [
            {
              StartTimecode: "00:00:00:00",
              EndTimecode: fullClipEndTc,
            },
          ],
          AudioSelectors: {
            // narration exists but NOT default
            "Audio Selector 1": {
              ExternalAudioFileInput: narrationAudioPath,
              DefaultSelection: "NOT_DEFAULT",
            },
            // embedded clip audio IS default
            "Audio Selector 2": {
              SelectorType: "TRACK",
              Tracks: [1],
              DefaultSelection: "DEFAULT",
            },
          },
          AudioSelectorGroups: {
            // embedded only
            "Audio Selector Group 1": {
              AudioSelectorNames: ["Audio Selector 2"],
            },
          },
        });
      }
    }

    // ----------------------------------
    // Build MediaConvert job request
    // ----------------------------------
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
                      Bitrate: 4500000,
                      FramerateControl: "SPECIFIED",
                      FramerateNumerator: 24000,
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
                },
                AudioDescriptions: [
                  {
                    // each input provides "Audio Selector Group 1"
                    AudioSourceName: "Audio Selector Group 1",
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 128000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48000,
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

    const command = new CreateJobCommand(jobParams);
    const responseJob = await mediaConvertClient.send(command);

    console.log("MediaConvert job created:", responseJob.Job?.Id);

    // Build final URL (pick first non-empty because doubled)   CodecLevel: "AUTO",
    const firstNonEmptyVideo =
      (videoUrls as string[]).find((u) => Boolean(u)) || "";
    let finalVideoUrl: string;

    if (firstNonEmptyVideo) {
      const parts = firstNonEmptyVideo.split("/");
      const fileName = parts[parts.length - 1];
      const baseName = fileName.split(".")[0];
      finalVideoUrl = `https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/${baseName}.mp4`;
    } else {
      finalVideoUrl =
        "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/fallback-output.mp4";
    }

    return res.json({
      message: "MediaConvert job submitted successfully",
      jobId: responseJob.Job?.Id,
      job: responseJob.Job,
      videoUrl: finalVideoUrl,
      videoLength: totalVideoLengthSec, // narration + (A+B showcase) per scene
    });
  } catch (error: any) {
    console.error("Error creating MediaConvert job:", error);
    return res.status(500).json({ error: error.message });
  }
}

// getJobStatus
export async function getJobStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId parameter" });
    }

    const command = new GetJobCommand({ Id: jobId });
    const responseJob = await mediaConvertClient.send(command);

    const jobStatus = responseJob.Job?.Status;
    console.log(`MediaConvert job ${jobId} status: ${jobStatus}`);

    // If it errored, print exactly WHY AWS says it errored
    if (jobStatus === "ERROR") {
      console.log(`ERROR DETAILS [${jobId}]:`, responseJob.Job?.ErrorMessage);
    }

    return res.json({ status: jobStatus });
  } catch (error: any) {
    console.error("Error getting MediaConvert job status:", error);
    return res.status(500).json({ error: error.message });
  }
}

// Router
const router: any = Router();
router.post("/create-video", createVideo);
router.get("/job-status/:jobId", getJobStatus);

export default router;
