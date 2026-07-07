// src/routes/trimAudio.ts
import { Router, Request, Response } from "express";
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import dotenv from "dotenv";

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

/* ------------------------------------------------------------------ */
/*  MediaConvert client                                                */
/* ------------------------------------------------------------------ */

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT, // It's best practice to load this from .env
}); //

// 1) Create an instance
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "", // replace with your access key id
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "", // replace with your secret access key
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const FPS = 30;
const toTimecode = (seconds: number): string => {
  const frames = Math.floor((seconds - Math.floor(seconds)) * FPS);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
};

const waitForJobComplete = async (id: string, tries = 60): Promise<void> => {
  for (let i = 0; i < tries; i++) {
    const { Job } = await mediaConvertClient.send(
      new GetJobCommand({ Id: id })
    );
    const st = Job?.Status;
    if (st === "COMPLETE") return;
    if (st === "ERROR" || st === "CANCELED")
      throw new Error(`MediaConvert job ${id} ${st}`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error("MediaConvert job timeout");
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type TrimReqBody = {
  originalAudio: string;
  start: number;
  end: number;
  outputBucket: string;
};

/* ------------------------------------------------------------------ */
/*  Router handler                                                     */
/* ------------------------------------------------------------------ */
const trimAudioHandler = async (
  req: Request<{}, unknown, TrimReqBody>,
  res: Response
): Promise<void> => {
  try {
    const { originalAudio, start, end, outputBucket } = req.body;
    if (!originalAudio || start == null || end == null || !outputBucket) {
      res
        .status(400)
        .json({ error: "originalAudio, start, end, outputBucket required" });
      return;
    }

    /* ---- S3 URI helper ---- */
    const toS3Uri = (url: string): string => {
      const base = url.split("?")[0];
      if (base.startsWith("s3://")) return base;
      const m = base.match(
        /^https?:\/\/([^/.]+)\.s3[.-][^/]+\.amazonaws\.com\/(.+)$/i
      );
      if (m) return `s3://${m[1]}/${m[2]}`;
      throw new Error("originalAudio must be an S3 URL or s3:// URI");
    };

    /* ---- Timecodes ---- */
    const startTC = toTimecode(start);
    const endTC = toTimecode(end);

    /* -------------------------------------------------------------- */
    /*  Input definition (typed)                                       */
    /* -------------------------------------------------------------- */
    type JobInput = NonNullable<
      NonNullable<CreateJobCommandInput["Settings"]>["Inputs"]
    >[number];

    const input: JobInput = {
      FileInput: toS3Uri(originalAudio),
      TimecodeSource: "ZEROBASED",
      InputClippings: [{ StartTimecode: startTC, EndTimecode: endTC }],
      AudioSelectors: {
        "Audio Selector 1": { DefaultSelection: "DEFAULT" },
      },
    };

    /* ---- Output key ---- */
    const baseName = originalAudio.split("/").pop()!.split(".")[0];
    const timestamp = Date.now();
    const outKey = `${outputBucket.replace(
      /\/+$/,
      ""
    )}/${baseName}-trim-${timestamp}.mp3`;
    const outKeyNoExt = outKey.replace(/\.mp3$/, "");

    /* -------------------------------------------------------------- */
    /*  Job params                                                    */
    /* -------------------------------------------------------------- */

    // ---- Job params ----
    const jobParams: CreateJobCommandInput = {
      Role: "arn:aws:iam::469269069267:role/MediaConvertRole", // your IAM role
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" },
        Inputs: [input],
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: { Destination: outKeyNoExt },
            },
            Outputs: [
              {
                ContainerSettings: { Container: "RAW" }, // audio-only
                AudioDescriptions: [
                  {
                    AudioSourceName: "Audio Selector 1",
                    CodecSettings: {
                      Codec: "MP3",
                      Mp3Settings: {
                        /* ðŸ‘‡  ADD THIS  */
                        RateControlMode: "CBR", // or  "VBR"
                        /* -------------------------------- */
                        Bitrate: 128_000,
                        Channels: 2,
                        SampleRate: 48_000,
                        // remove VbrQuality when using CBR
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

    /* ---- Submit & wait ---- */
    const { Job } = await mediaConvertClient.send(
      new CreateJobCommand(jobParams)
    );
    if (!Job?.Id) throw new Error("Failed to create MediaConvert job");
    await waitForJobComplete(Job.Id);

    /* ---- Public URL ---- */
    const region =
      typeof mediaConvertClient.config.region === "string"
        ? mediaConvertClient.config.region
        : await mediaConvertClient.config.region();

    const match = outKey.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error("Bad S3 URI");
    const [, bucket, key] = match as [string, string, string];

    const trimmedUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log("trimmed url audio", trimmedUrl);

    if (req.path !== "/create-lipsync-trimaudio") {
      // Delete the temporary original audio after AudioPicker processing.
      const originalUri = toS3Uri(originalAudio);
      const [, inBucket, ...inPath] = originalUri.match(
        /^s3:\/\/([^/]+)\/(.+)$/
      )!;
      const inKey = inPath.join("/");
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: inBucket, Key: inKey })
        );
        console.log(`Deleted original audio s3://${inBucket}/${inKey}`);
      } catch (deleteErr) {
        console.warn("Failed to delete original audio:", deleteErr);
      }
    }

    res.json({ message: "Audio trimmed", jobId: Job.Id, audioUrl: trimmedUrl });
  } catch (err) {
    const error = err as Error;
    console.error("trimAudioHandler error", error);
    res.status(500).json({ error: error.message });
  }
};

/* ------------------------------------------------------------------ */
/*  Router export                                                     */
/* ------------------------------------------------------------------ */
const router = Router();
router.post("/create-trimaudio", trimAudioHandler);
router.post("/create-lipsync-trimaudio", trimAudioHandler);
export default router;
