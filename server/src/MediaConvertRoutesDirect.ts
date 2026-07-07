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
  // Ensure we don't return negative timecode if length is 0
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
 * UPDATED behavior (Direct Video Merge):
 * - Merges video clips in sequence: Scene 1 (A then B) -> Scene 2 (A then B)...
 * - Narration audio is COMPLETELY IGNORED.
 * - Uses the embedded audio from each video clip.
 *
 * IMPORTANT: videoUrls is ALWAYS DOUBLED: [A1,B1,A2,B2,...]
 */
export async function createVideo(req: Request, res: Response) {
  try {
    const {
      videoUrls, // string[] ALWAYS DOUBLED: [A1,B1,A2,B2,...]
      outputResolution, // "1920x1080"
      outputBucket, // "s3://bucket/path/"
      clipDurations, // number: duration in seconds of EACH AI clip
      // audioUrls & audioDurations are ignored but kept in destructuring to avoid breaking existing calls
    } = req.body;

    // ---- basic validation ----
    if (
      !videoUrls ||
      !outputResolution ||
      !outputBucket ||
      clipDurations == null
    ) {
      return res.status(400).json({
        error:
          "Missing one of: videoUrls[], outputResolution, outputBucket, clipDurations",
      });
    }

    if (!Array.isArray(videoUrls)) {
      return res.status(400).json({ error: "videoUrls must be an array" });
    }

    // Since videoUrls is doubled (A+B per scene), sceneCount is length / 2
    if (videoUrls.length % 2 !== 0) {
      return res.status(400).json({
        error: `videoUrls length must be even (A+B per scene). Got ${videoUrls.length}`,
      });
    }

    const sceneCount = videoUrls.length / 2;

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

    // Total runtime = (Scene 1 A+B) + (Scene 2 A+B) + ...
    const totalVideoLengthSec = videoUrls.length * CLIP_LENGTH_SEC;

    for (let i = 0; i < sceneCount; i++) {
      // âœ… Stage 1 / Stage 2 per scene
      const videoA: string = videoUrls[i * 2];
      const videoB: string = videoUrls[i * 2 + 1];

      // We just play A then B.
      // If a slot is empty string, we skip it to prevent MediaConvert error.
      const sceneClips = [videoA, videoB].filter(
        (url) => url && url.trim().length > 0
      );

      for (const videoFile of sceneClips) {
        inputs.push({
          FileInput: videoFile,
          TimecodeSource: "ZEROBASED",
          InputClippings: [
            {
              StartTimecode: "00:00:00:00",
              EndTimecode: fullClipEndTc,
            },
          ],
          AudioSelectors: {
            // Use embedded audio track 1
            "Audio Selector 1": {
              SelectorType: "TRACK",
              Tracks: [1],
              DefaultSelection: "DEFAULT",
            },
          },
          AudioSelectorGroups: {
            "Audio Selector Group 1": {
              AudioSelectorNames: ["Audio Selector 1"],
            },
          },
        });
      }
    }

    if (inputs.length === 0) {
      return res.status(400).json({ error: "No valid video URLs provided." });
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

    console.log("MediaConvert Job Params:", JSON.stringify(jobParams, null, 2));

    const command = new CreateJobCommand(jobParams);
    const responseJob = await mediaConvertClient.send(command);

    console.log("MediaConvert job created:", responseJob.Job?.Id);

    // Build final URL (pick first non-empty input to guess naming, or fallback)
    const firstInput = inputs[0]?.FileInput || "";
    let finalVideoUrl: string;

    if (firstInput) {
      const parts = firstInput.split("/");
      const fileName = parts[parts.length - 1];
      const baseName = fileName.split(".")[0];
      // Note: If inputs have different base names, this just picks the first one's name.
      // Ensure your outputBucket doesn't already end in a filename if you want a specific output name.
      // Usually outputBucket ends in '/', and MediaConvert appends the modifier or we specify name modifier.
      // Without NameModifier, it might default.
      // Assuming your previous logic worked for naming:
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
      videoLength: totalVideoLengthSec,
    });
  } catch (error: any) {
    console.error("Error creating MediaConvert job:", error);
    return res.status(500).json({ error: error.message });
  }
}

// getJobStatus   CodecLevel: "AUTO",
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

// Router
const router: any = Router();
router.post("/create-videoDirect", createVideo);
router.get("/job-status/:jobId", getJobStatus);

export default router;
