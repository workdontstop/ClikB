import { Request, Response, Router } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  CreateJobCommandInput,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// 1) Instantiate the v3 MediaConvertClient (with your credentials)
// ---------------------------------------------------------------------------
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT,
});

// ---------------------------------------------------------------------------
// Helper: Convert seconds -> 'HH:MM:SS:FF' at 30 fps
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 2) createVideo route
// ---------------------------------------------------------------------------
export async function createVideo(req: Request, res: Response) {
  try {
    const {
      audioUrls, // string[] of S3 paths for scene narration audio
      imageUrls, // string[] of S3 paths for fallback images
      videoUrls, // string[] ALWAYS DOUBLED: [A1,B1,A2,B2,...]   CodecLevel: "AUTO",
      audioDurations, // number[] narration lengths in seconds (per scene)
      clipDurations: originalClipDurations, // number: duration in seconds of EACH AI clip (5 or 10)
      outputResolution,
      outputBucket,
    } = req.body;

    // Convert to number for checking
    let clipDurations = Number(originalClipDurations);

    // Intercept 6s (Hailuo 2.3) and force to 5s to avoid validation errors and sync issues
    if (clipDurations === 6) {
        clipDurations = 5;
    }

    // Basic validation: presence
    if (
      !audioUrls ||
      !imageUrls ||
      !audioDurations ||
      clipDurations == null ||
      !outputResolution ||
      !outputBucket ||
      !videoUrls
    ) {
      return res.status(400).json({
        error:
          "Missing one of: audioUrls[], imageUrls[], videoUrls[], audioDurations[], clipDurations, outputResolution, outputBucket",
      });
    }

    // Validate clipDurations: only 5 or 10 seconds for now
    if (
      typeof clipDurations !== "number" ||
      (clipDurations !== 5 && clipDurations !== 10)
    ) {
      return res.status(400).json({
        error:
          "clipDurations must be a number equal to 5 or 10 (seconds per AI clip)",
      });
    }

    const sceneCount = audioUrls.length;

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
        .json({ error: "Invalid outputResolution format (e.g. '1920x1080')" });
    }

    const inputs: any[] = [];

    const CLIP_LENGTH_SEC = clipDurations; // 5 or 10
    const FPS = 30;

    const fullClipEndTimecode =
      CLIP_LENGTH_SEC === 5
        ? "00:00:04:29"
        : CLIP_LENGTH_SEC === 10
        ? "00:00:09:29"
        : toTimecode(CLIP_LENGTH_SEC, FPS);

    // Real output timeline length (because you force Stage1+Stage2 minimum)
    const totalTimelineLengthSec = audioDurations.reduce(
      (sum: number, d: number) => {
        return sum + Math.max(d, 2 * CLIP_LENGTH_SEC);
      },
      0
    );

    // -----------------------------------------------------------------------
    // Scene-building loop
    // Rule per scene:
    // - ALWAYS play Stage 1 (A) then Stage 2 (B) at least once (min 2 clips)
    // - If narration longer, keep looping A,B,A,Bâ€¦ until narration done, then cut
    // -----------------------------------------------------------------------
    for (let i = 0; i < sceneCount; i++) {
      const audioPath = audioUrls[i];
      const narrationSec = audioDurations[i];
      const imagePath = imageUrls[i];

      const videoA = videoUrls[i * 2];
      const videoB = videoUrls[i * 2 + 1];

      const hasVideo = Boolean(videoA || videoB);

      if (hasVideo) {
        const targetVisualSec = Math.max(narrationSec, 2 * CLIP_LENGTH_SEC);
        const tiles = Math.ceil(targetVisualSec / CLIP_LENGTH_SEC);

        const pickClip = (tileIndex: number) => {
          if (videoA && videoB) return tileIndex % 2 === 0 ? videoA : videoB; // A then B then A...
          return videoA || videoB; // fallback if one is missing
        };

        for (let t = 0; t < tiles; t++) {
          const offsetMs = -(t * CLIP_LENGTH_SEC * 1000);

          const remainingSec = targetVisualSec - t * CLIP_LENGTH_SEC;
          const thisTileSec = Math.min(CLIP_LENGTH_SEC, remainingSec);

          const endTc =
            thisTileSec === CLIP_LENGTH_SEC
              ? fullClipEndTimecode
              : toTimecode(thisTileSec, FPS);

          inputs.push({
            FileInput: pickClip(t),
            TimecodeSource: "ZEROBASED",
            InputClippings: [
              {
                StartTimecode: "00:00:00:00",
                EndTimecode: endTc,
              },
            ],
            AudioSelectors: {
              "Audio Selector 1": {
                ExternalAudioFileInput: audioPath,
                Offset: offsetMs,
                DefaultSelection: "DEFAULT",
              },
            },
          });
        }
      } else {
        // image + audio scene fallback
        const sceneMs = Math.round(narrationSec * 1000);
        inputs.push({
          FileInput: audioPath,
          TimecodeSource: "ZEROBASED",
          AudioSelectors: {
            "Audio Selector 1": { DefaultSelection: "DEFAULT" },
          },
          ImageInserter: {
            InsertableImages: [
              {
                ImageInserterInput: imagePath,
                Duration: sceneMs,
                Layer: 0,
                Opacity: 100,
                StartTime: "00:00:00:00",
                ImageX: 0,
                ImageY: 0,
                Width: width,
                Height: height,
              },
            ],
          },
        });
      }
    }

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
              FileGroupSettings: {
                Destination: outputBucket,
              },
            },
            Outputs: [
              {
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: {
                    MoovPlacement: "PROGRESSIVE_DOWNLOAD",
                  },
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
                    AudioSourceName: "Audio Selector 1",
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

    // Derive final video URL: pick first non-empty (since doubled can include blanks)
    let finalVideoUrl: string;
    const firstNonEmptyVideo =
      (videoUrls as string[]).find((u) => Boolean(u)) || null;

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
      videoLength: totalTimelineLengthSec, // âœ… actual MP4 timeline length now
    });
  } catch (error: any) {
    console.error("Error creating MediaConvert job:", error);
    return res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// 3) getJobStatus route
// ---------------------------------------------------------------------------
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
    return res.json({ status: jobStatus });
  } catch (error: any) {
    console.error("Error getting MediaConvert job status:", error);
    return res.status(500).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// 4) Router
// ---------------------------------------------------------------------------
const router: any = Router();
router.post("/create-videonoaudio", createVideo);
router.get("/job-status/:jobId", getJobStatus);

export default router;
