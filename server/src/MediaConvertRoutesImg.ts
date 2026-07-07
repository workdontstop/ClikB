import { Request, Response, Router } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  CreateJobCommandInput,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

dotenv.config();

// 1) Instantiate the v3 MediaConvertClient
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT, // It's best practice to load this from .env
}); //

// Helper: Convert seconds -> 'HH:MM:SS:FF' at 30fps
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
  ].join(":"); // e.g. "00:05:03:10"
}

// 2) createVideo route
export async function createVideoimg(req: Request, res: Response) {
  try {
    const {
      audioUrls,
      imageUrls,
      videoUrls,
      audioDurations,
      outputResolution,
      outputBucket,
    } = req.body;

    if (
      !audioUrls ||
      !imageUrls ||
      !audioDurations ||
      !outputResolution ||
      !outputBucket
    ) {
      return res.status(400).json({
        error:
          "Missing one of: audioUrls[], imageUrls[], audioDurations[], outputResolution, outputBucket",
      });
    }

    // Validate arrays
    if (
      !Array.isArray(audioUrls) ||
      !Array.isArray(imageUrls) ||
      !Array.isArray(audioDurations)
    ) {
      return res.status(400).json({
        error: "audioUrls, imageUrls, and audioDurations must be arrays",
      });
    }

    if (audioUrls.length !== audioDurations.length) {
      return res.status(400).json({
        error: "audioUrls and audioDurations must be the same length",
      });
    }

    // âœ… story mode support:   CodecLevel: "AUTO",
    // imageUrls can be:
    // - 1 per scene  => length == audioUrls.length
    // - 2 per scene  => length == audioUrls.length * 2  (stage1, stage2)
    const pairedImages = imageUrls.length === audioUrls.length * 2;
    const singleImages = imageUrls.length === audioUrls.length;

    if (!pairedImages && !singleImages) {
      return res.status(400).json({
        error: `imageUrls must be length ${audioUrls.length} (1 per scene) OR ${
          audioUrls.length * 2
        } (2 per scene). Got ${imageUrls.length}.`,
      });
    }

    // Parse output resolution (expects format like "1920x1080")
    const [width, height] = String(outputResolution).split("x").map(Number);
    if (!width || !height) {
      return res.status(400).json({ error: "Invalid outputResolution format" });
    }

    const getStageImages = (sceneIndex: number) => {
      if (pairedImages) {
        return {
          stage1: imageUrls[sceneIndex * 2],
          stage2: imageUrls[sceneIndex * 2 + 1],
        };
      }
      // fallback: stage2 repeats stage1
      return {
        stage1: imageUrls[sceneIndex],
        stage2: imageUrls[sceneIndex],
      };
    };

    const inputs: any[] = [];
    let currentTimeSec = 0; // total video duration
    const insertableOverlays: any[] = [];

    const FADE_IN_MS = 1000;
    const FADE_OUT_MS = 1000;

    // Constant for video clip duration in seconds (used when video overlay is available)
    const VIDEO_OVERLAY_DURATION_SEC = 5;

    // Loop over each audio scene
    audioUrls.forEach((audioPath: string, i: number) => {
      // Add the audio input
      inputs.push({
        FileInput: audioPath,
        TimecodeSource: "ZEROBASED",
        AudioSelectors: {
          "Audio Selector 1": {
            DefaultSelection: "DEFAULT",
          },
        },
      });

      const durationSecRaw = Number(audioDurations[i] ?? 0);
      const durationSec =
        Number.isFinite(durationSecRaw) && durationSecRaw > 0
          ? durationSecRaw
          : 0;

      const sceneStartTimeSec = currentTimeSec;

      // âœ… If a video is provided, keep your old behavior
      // (If you want video ALSO split into stage1/stage2 later, tell me)
      if (videoUrls && Array.isArray(videoUrls) && videoUrls[i]) {
        const videoClipUrl = videoUrls[i];

        const fullVideoSegments = Math.floor(
          durationSec / VIDEO_OVERLAY_DURATION_SEC
        );

        const remainderSec =
          durationSec - fullVideoSegments * VIDEO_OVERLAY_DURATION_SEC;

        for (let seg = 0; seg < fullVideoSegments; seg++) {
          const segmentStartTimeSec =
            sceneStartTimeSec + seg * VIDEO_OVERLAY_DURATION_SEC;

          insertableOverlays.push({
            ImageInserterInput: videoClipUrl,
            Layer: i * 100 + seg,
            Opacity: 100,
            FadeIn: seg === 0 ? 0 : FADE_IN_MS,
            FadeOut: FADE_OUT_MS,
            StartTime: toTimecode(segmentStartTimeSec, 30),
            Duration: VIDEO_OVERLAY_DURATION_SEC * 1000,
            ImageX: 0,
            ImageY: 0,
            Width: width,
            Height: height,
          });
        }

        if (remainderSec > 0) {
          const remainderStartTimeSec =
            sceneStartTimeSec + fullVideoSegments * VIDEO_OVERLAY_DURATION_SEC;

          // Use the stage1 image as fallback overlay
          const { stage1 } = getStageImages(i);

          insertableOverlays.push({
            ImageInserterInput: stage1,
            Layer: i * 100 + fullVideoSegments,
            Opacity: 100,
            FadeIn: FADE_IN_MS,
            FadeOut: FADE_OUT_MS,
            StartTime: toTimecode(remainderStartTimeSec, 30),
            Duration: remainderSec * 1000,
            ImageX: 0,
            ImageY: 0,
            Width: width,
            Height: height,
          });
        }
      } else {
        // âœ… No video: use TWO images per scene, each 50% of audio duration
        const { stage1, stage2 } = getStageImages(i);

        const stage1Sec = durationSec / 2;
        const stage2Sec = durationSec - stage1Sec;

        // Stage 1 overlay
        insertableOverlays.push({
          ImageInserterInput: stage1,
          Layer: i * 10 + 1,
          Opacity: 100,
          FadeIn: 0,
          FadeOut: FADE_OUT_MS,
          StartTime: toTimecode(sceneStartTimeSec, 30),
          Duration: stage1Sec * 1000,
          ImageX: 0,
          ImageY: 0,
          Width: width,
          Height: height,
        });

        // Stage 2 overlay
        insertableOverlays.push({
          ImageInserterInput: stage2,
          Layer: i * 10 + 2,
          Opacity: 100,
          FadeIn: FADE_IN_MS,
          FadeOut: FADE_OUT_MS,
          StartTime: toTimecode(sceneStartTimeSec + stage1Sec, 30),
          Duration: stage2Sec * 1000,
          ImageX: 0,
          ImageY: 0,
          Width: width,
          Height: height,
        });
      }

      currentTimeSec += durationSec;
    });

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
                  VideoPreprocessors: {
                    ImageInserter: {
                      InsertableImages: insertableOverlays,
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

    console.log("MediaConvert job created:", responseJob.Job?.Id);

    // Compute the final video URL using the first audio file's name.
    const firstAudioUrl = audioUrls[0];
    const audioUrlParts = firstAudioUrl.split("/");
    const audioFileName = audioUrlParts[audioUrlParts.length - 1];
    const baseName = audioFileName.split(".")[0];
    const finalVideoUrl = `https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/${baseName}.mp4`;

    return res.json({
      message: "MediaConvert job submitted successfully",
      jobId: responseJob.Job?.Id,
      job: responseJob.Job,
      videoUrl: finalVideoUrl,
      videoLength: currentTimeSec,
    });
  } catch (error: any) {
    console.error("Error creating MediaConvert job:", error);
    return res.status(500).json({ error: error.message });
  }
}

// 3) getJobStatus route
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

// 4) Create and export a router
const router: any = Router();

router.post("/create-videoimg", createVideoimg);
router.get("/job-status/:jobId", getJobStatus);

export default router;
