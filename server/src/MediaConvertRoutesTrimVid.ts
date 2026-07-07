import { Router, Request, Response } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

dotenv.config();

/* ------------------------------------------------------------------
 * MediaConvert client
 * ------------------------------------------------------------------*/
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT,
});

/* ----------------------------------------------
 * Helpers
 * ----------------------------------------------*/
const FPS = 30;

function toTimecode(input: string | number): string {
  // If they send a full timecode already, just validate-ish and return it   CodecLevel: "AUTO",
  if (
    typeof input === "string" &&
    /[:;].*[:;]/.test(input) &&
    input.split(/[:;]/).length >= 4
  ) {
    // Example: "00:01:23:12" or "00:01:23;12"
    // You can keep it as-is (or add stricter validation if you want)
    return input.replace(";", ":");
  }

  // Convert input into TOTAL seconds (can be fractional)
  let totalSeconds: number;

  if (typeof input === "number") {
    totalSeconds = input;
  } else {
    const s = input.trim();
    if (!s) totalSeconds = 0;
    else {
      const parts = s.split(":"); // can be "SS", "MM:SS", "HH:MM:SS"
      if (parts.length === 1) {
        totalSeconds = Number(parts[0]);
      } else if (parts.length === 2) {
        const mm = Number(parts[0]);
        const ss = Number(parts[1]);
        totalSeconds = mm * 60 + ss;
      } else if (parts.length === 3) {
        const hh = Number(parts[0]);
        const mm = Number(parts[1]);
        const ss = Number(parts[2]);
        totalSeconds = hh * 3600 + mm * 60 + ss;
      } else {
        throw new Error("Bad time format");
      }
    }
  }

  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new Error("Bad time format");
  }

  // Build normalized HH:MM:SS:FF at FPS
  let h = Math.floor(totalSeconds / 3600);
  let rem = totalSeconds - h * 3600;

  let m = Math.floor(rem / 60);
  rem = rem - m * 60;

  let sInt = Math.floor(rem);
  let frac = rem - sInt;

  // frames with carry handling
  let frames = Math.round(frac * FPS);
  if (frames >= FPS) {
    frames = 0;
    sInt += 1;
  }
  if (sInt >= 60) {
    sInt -= 60;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    h += 1;
  }

  if (h > 24) throw new Error("Timecode hour out of range for MediaConvert");

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    sInt
  ).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

async function waitForJobComplete(id: string, tries = 60, delay = 5_000) {
  for (let i = 0; i < tries; i++) {
    const { Job } = await mediaConvertClient.send(
      new GetJobCommand({ Id: id })
    );
    const st = Job?.Status;
    if (st === "COMPLETE") return;
    if (st === "ERROR" || st === "CANCELED") {
      throw new Error(`MediaConvert job ${id} ${st}`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("MediaConvert job timeout");
}

function toS3Uri(url: string): string {
  const base = url.split("?")[0];
  if (base.startsWith("s3://")) return base;

  const m = base.match(
    /^https?:\/\/(.*?)\.s3[.-][^/]+\.amazonaws\.com\/(.+)$/i
  );
  if (m) return `s3://${m[1]}/${m[2]}`;

  throw new Error("video must be an S3 URL or s3:// URI");
}

function toEvenInt(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n % 2 === 0 ? n : n - 1; // H.264 usually wants even dimensions
}

/* ------------------------------------------------
 * Handler
 * ------------------------------------------------*/
const trimVideoHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      video,
      start,
      end,
      outputBucket,
      inputWidth,
      inputHeight,
    } = req.body;

    if (!video || start === undefined || end === undefined || !outputBucket) {
      res.status(400).json({
        error: "video, start, end, outputBucket required",
      });
      return;
    }

    // âœ… Desired output frame (and therefore aspect ratio) comes from the frontend
    let targetWidth = toEvenInt(inputWidth);
    let targetHeight = toEvenInt(inputHeight);

    // If you want to FORCE aspect ratio always, you should require these:
    if (!targetWidth || !targetHeight) {
      res.status(400).json({
        error:
          "inputWidth and inputHeight are required to enforce aspect ratio",
      });
      return;
    }

    // ---------------------------------------------------------
    // ðŸ”¥ FIX: Clamp dimensions to Kling O3 Max (2160px)
    // ---------------------------------------------------------
    const MAX_KLING_SIZE = 2160;
    if (targetWidth > MAX_KLING_SIZE || targetHeight > MAX_KLING_SIZE) {
      const ratio = targetWidth / targetHeight;
      if (targetWidth >= targetHeight) {
        targetWidth = MAX_KLING_SIZE;
        targetHeight = toEvenInt(Math.round(MAX_KLING_SIZE / ratio));
      } else {
        targetHeight = MAX_KLING_SIZE;
        targetWidth = toEvenInt(Math.round(MAX_KLING_SIZE * ratio));
      }
    }
    // ---------------------------------------------------------

    const startTC = toTimecode(start);
    const endTC = toTimecode(end);

    const inputClip: any = {
      FileInput: toS3Uri(video),
      TimecodeSource: "ZEROBASED",
      InputClippings: [{ StartTimecode: startTC, EndTimecode: endTC }],
      AudioSelectors: {
        "Audio Selector 1": { DefaultSelection: "DEFAULT" as const },
      },
    };

    const keyParts = String(video).split("/");
    const baseName = keyParts[keyParts.length - 1].split(".")[0];
    const timestamp = Date.now();

    // IMPORTANT: outputBucket should be like: s3://my-bucket/some/prefix
    const outPrefix = String(outputBucket).replace(/\/+$/, "");
    const outKey = `${outPrefix}/${baseName}-trim-${timestamp}.mp4`;
    const outDestNoExt = outKey.replace(/\.mp4$/, "");

    const jobParams: CreateJobCommandInput = {
      Role:
        process.env.MEDIACONVERT_ROLE_ARN ??
        "arn:aws:iam::469269069267:role/MediaConvertRole",
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" },
        Inputs: [inputClip],
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: {
                Destination: outDestNoExt,
              },
            },
            Outputs: [
              {
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: {
                    MoovPlacement: "PROGRESSIVE_DOWNLOAD",
                    CslgAtom: "EXCLUDE",
                    FreeSpaceBox: "EXCLUDE",
                  },
                },
                VideoDescription: {
                  // âœ… Force output size (therefore aspect ratio) from inputWidth/inputHeight
                  Width: targetWidth,
                  Height: targetHeight,

                  // âœ… Preserves aspect ratio and crops excess (center-crop) to fill target frame
                  ScalingBehavior: "FILL",

                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "QVBR",
                      MaxBitrate: 5_000_000,
                      QvbrSettings: { QvbrQualityLevel: 8 },
                      AdaptiveQuantization: "HIGH",
                      SceneChangeDetect: "ENABLED",
                      // Force 30fps to satisfy Kling O3 requirement (min 24fps)
                      FramerateControl: "SPECIFIED",
                      FramerateConversionAlgorithm: "DUPLICATE_DROP",
                      FramerateNumerator: 30,
                      FramerateDenominator: 1,
                    },
                  },
                },
                AudioDescriptions: [
                  {
                    AudioSourceName: "Audio Selector 1",
                    AudioTypeControl: "FOLLOW_INPUT",
                    LanguageCodeControl: "FOLLOW_INPUT",
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

    const { Job } = await mediaConvertClient.send(
      new CreateJobCommand(jobParams)
    );
    if (!Job?.Id) throw new Error("Failed to create MediaConvert job");

    await waitForJobComplete(Job.Id);

    const regionVal =
      typeof mediaConvertClient.config.region === "string"
        ? mediaConvertClient.config.region
        : await mediaConvertClient.config.region();

    // If outKey is s3://bucket/key..., make it https://...
    const trimmedUrl = outKey.replace(
      /^s3:\/\/(.*?)\/(.*)$/,
      (_, bucket, key) =>
        `https://${bucket}.s3.${regionVal}.amazonaws.com/${key}`
    );

    console.log(inputWidth);
    console.log(inputHeight);
    res.json({
      message:
        "Video trimmed and resized (aspect ratio enforced from inputWidth/inputHeight)",
      jobId: Job.Id,
      videoUrl: trimmedUrl,
      width: targetWidth,
      height: targetHeight,
    });
  } catch (err: any) {
    console.error("trimVideoHandler error", err);
    res.status(500).json({ error: err.message });
  }
};

const router = Router();
router.post("/Trim-video", trimVideoHandler);
export default router;
