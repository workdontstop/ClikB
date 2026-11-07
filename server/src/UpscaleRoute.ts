// import { Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fal } from "@fal-ai/client";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CreateJobCommandInput,
} from "@aws-sdk/client-mediaconvert";
import crypto from "crypto";
import { promisify } from "util";
import { videoUpscaleResolution } from "./videoUpscaleSpec";

dotenv.config();

const randomBytes = promisify(crypto.randomBytes);

// Environment Variables for S3
const BUCKET_NAME = process.env.BUCKET_NAME as string;
const REGION = process.env.BUCKET_REGION as string;
const ACCESS_KEY_ID = process.env.BUCKET_ACCESS_KEY as string;
const SECRET_ACCESS_KEY = process.env.BUCKET_SECRET_KEY as string;

// Initialize S3 Client
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

fal.config({
  credentials: process.env.FAL_KEY!,
});

const mediaConvertClient = new MediaConvertClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  endpoint:
    process.env.MEDIA_CONVERT_ENDPOINT ||
    "https://q25wbt2lc.mediaconvert.us-east-1.amazonaws.com",
});

// Helper: Parse S3 URI/URL to get Key
function getS3KeyFromUrl(url: string): string | null {
  try {
    const base = url.split("?")[0];
    const match = base.match(/^https?:\/\/([^/.]+)\.s3[.-][^/]+\.amazonaws\.com\/(.+)$/);
    if (match) return match[2]; // Key
    return null;
  } catch (e) {
    return null;
  }
}

export async function upscaleImageRoute(req: any, res: any) {
  try {
    const { url, size, linkmode } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Missing image URL" });
    }

    console.log("Upscaling image:", url, "Target size:", size || "Default");

    // 1. Call Replicate Upscaler
    const replicateToken = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
    const replicateModelEndpoint = "https://api.replicate.com/v1/models/recraft-ai/recraft-crisp-upscale/predictions";
    
    console.log("Using Replicate Token:", replicateToken ? "Present" : "Missing");
    console.log("Sending URL to Replicate:", url);

    const inputPayload: any = { image: url };
    if (size) {
        inputPayload.size = size;
    }

    const response = await fetch(replicateModelEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${replicateToken}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: inputPayload,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Replicate API Error:", response.status, errText);
      throw new Error(`Replicate Error: ${errText}`);
    }

    const prediction: any = await response.json();
    
    // Poll if not finished immediately
    let status = prediction.status;
    let resultUrl = prediction.output;
    let predictId = prediction.id;

    console.log("Prediction ID:", predictId, "Status:", status);

    while (status !== "succeeded" && status !== "failed" && status !== "canceled") {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictId}`, {
         headers: { Authorization: `Bearer ${replicateToken}` },
      });
      const pollData: any = await poll.json();
      status = pollData.status;
      resultUrl = pollData.output;
      console.log("Polling... Status:", status);
      if (status === "failed") {
          console.error("Replicate Prediction Failed:", pollData);
          throw new Error("Upscale failed");
      }
    }

    if (!resultUrl) {
        console.error("No output URL. Full prediction object:", prediction);
        throw new Error("No output URL from upscaler");
    }

    console.log("Upscale success! Download URL:", resultUrl);

    // URL mode keeps the upscaled image bytes away from EC2. The browser
    // downloads this temporary Replicate URL and performs the direct S3 upload.
    if (linkmode === true) {
      return res.json({ url: resultUrl, linkmode: true });
    }

    // 2. Download Upscaled Image
    const imgResp = await fetch(resultUrl);
    if (!imgResp.ok) {
        console.error("Failed to fetch upscaled image from Replicate:", imgResp.status, imgResp.statusText);
        throw new Error("Failed to download upscaled image");
    }
    const imgBuffer = await imgResp.arrayBuffer();
    const buffer = Buffer.from(imgBuffer);

    // 3. Upload to S3
    const rawBytes = await randomBytes(16);
    const newFileName = `upscaled-${rawBytes.toString("hex")}.png`;
    console.log("Uploading to S3:", newFileName);

    const uploadCmd = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: newFileName,
      Body: buffer,
      ContentType: "image/png",
      ACL: "public-read", // Or private depending on your needs, using public-read based on user context
    });

    await s3Client.send(uploadCmd);
    console.log("S3 Upload Successful");
    
    // Construct new S3 URL
    // Assuming standard URL structure: https://BUCKET.s3.REGION.amazonaws.com/KEY
    const newS3Url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${newFileName}`;

    // 4. Delete Old Image (fire and forget or await)
    const oldKey = getS3KeyFromUrl(url);
    if (oldKey) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: oldKey
        }));
        console.log("Deleted old image:", oldKey);
      } catch (delErr) {
        console.error("Failed to delete old image:", delErr);
      }
    }

    console.log("Upscale complete. New URL:", newS3Url);
    res.json({ url: newS3Url });

  } catch (err: any) {
    console.error("Upscale Route Error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Topaz settings for the GPT Image 2 grain rescue. These are the exact values that
 * tested clean against real ClikB frames — change them here, not at the call site.
 *
 *  model             Standard V2 is the only model exposing BOTH `denoise` and
 *                    `fix_compression`. Topaz's other models silently ignore one
 *                    or both, so this pairing is load-bearing.
 *  upscale_factor 1  Denoise WITHOUT enlarging. The pipeline normalises to
 *                    1080x1920, so any factor > 1 would force a downscale back.
 *  output_format png The endpoint defaults to "jpeg" — that would re-encode fresh
 *                    compression artifacts into an image we just paid to clean.
 *  face_enhancement  OFF deliberately. Run per-frame at the default 0.8 it nudges
 *                    each face its own way, which drifts a character across shots.
 *                    Cross-shot consistency is worth more here than a sharper face.
 *  denoise 1.0       Maximum. Tuned by eye on real frames; if fine detail (chainmail,
 *                    crowds, fabric weave) ever looks smeared, drop this first.
 *  fix_compression   The GPT Image 2 artifact is at least partly encoder-side, so
 *          0.5       this pulls its own weight alongside the denoiser.
 */
const TOPAZ_DENOISE_INPUT = {
  model: "Standard V2",
  upscale_factor: 1,
  output_format: "png",
  face_enhancement: false,
  denoise: 1,
  fix_compression: 0.5,
} as const;

/**
 * POST /denoiseImage  { url }  ->  { url }
 *
 * GPT Image 2 grain rescue. Runs fal `fal-ai/topaz/upscale/image` in denoise-only
 * configuration over a single image and republishes the result to S3.
 *
 * Why Topaz and not NAFNet: NAFNet is trained on camera sensor noise and has no
 * tuning knobs. Topaz separates `denoise` from `fix_compression`, which matters
 * because this artifact is not purely noise. Why fal and not Replicate: Replicate's
 * Topaz build exposes face enhancement only — it has no denoise parameter at all.
 *
 * Deliberate constraints:
 *  - This is NEVER called automatically. The only caller is the user-confirmed
 *    Upscale popup in EditStory. Nothing in a generation path may call it.
 *  - The output is named `denoised-*`, NOT `upscaled-*`. EditStory detects the HD
 *    state with `url.includes("upscaled")`, so a denoise-only result must not match
 *    or the Upscale button greys itself out and the user loses the resolution step.
 *  - When chained, denoise runs BEFORE upscale. NAFNet bills on input megapixels, so
 *    denoising after a 2x upscale costs ~4x as much for a worse result.
 */
export async function denoiseImageRoute(req: any, res: any) {
  try {
    const { url, linkmode } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing image URL" });
    }

    console.log("[TOPAZ DENOISE] Denoising image:", url, TOPAZ_DENOISE_INPUT);

    const result: any = await fal.subscribe("fal-ai/topaz/upscale/image", {
      input: { image_url: url, ...TOPAZ_DENOISE_INPUT },
    });

    const resultUrl: string =
      result?.data?.image?.url || result?.image?.url || "";

    if (!resultUrl) {
      console.error("[TOPAZ DENOISE] No output image. Full result:", result);
      throw new Error("No output image from the denoiser");
    }

    // URL mode keeps the denoised bytes away from EC2. The browser downloads
    // the temporary fal URL and uploads the final object directly to S3.
    if (linkmode === true) {
      return res.json({ url: resultUrl, linkmode: true });
    }

    // Download the denoised result
    const imgResp = await fetch(resultUrl);
    if (!imgResp.ok) {
      console.error("[TOPAZ DENOISE] Failed to fetch denoised image:", imgResp.status, imgResp.statusText);
      throw new Error("Failed to download the denoised image");
    }
    const buffer = Buffer.from(await imgResp.arrayBuffer());

    // Republish to S3 under a `denoised-` name (see note above about `upscaled`).
    const rawBytes = await randomBytes(16);
    const newFileName = `denoised-${rawBytes.toString("hex")}.png`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: newFileName,
      Body: buffer,
      ContentType: "image/png",
      ACL: "public-read",
    }));

    const newS3Url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${newFileName}`;

    // Drop the source object, matching upscaleImageRoute. There is no
    // "Clean / Original" toggle — the user's choice in the popup IS the toggle.
    const oldKey = getS3KeyFromUrl(url);
    if (oldKey) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: oldKey }));
        console.log("[TOPAZ DENOISE] Deleted source image:", oldKey);
      } catch (delErr) {
        console.error("[TOPAZ DENOISE] Failed to delete source image:", delErr);
      }
    }

    console.log("[TOPAZ DENOISE] Denoise complete. New URL:", newS3Url);
    return res.json({ url: newS3Url });
  } catch (err: any) {
    console.error("[TOPAZ DENOISE] Denoise route error:", err);
    return res.status(500).json({ error: err.message });
  }
}

export const VIDEO_UPSCALE_MODEL = "bytedance/video-upscaler";
const VIDEO_UPSCALE_MODEL_ENDPOINT = `https://api.replicate.com/v1/models/${VIDEO_UPSCALE_MODEL}/predictions`;
const VIDEO_UPSCALE_POLL_INTERVAL_MS = 2_000;
const VIDEO_UPSCALE_TIMEOUT_MS = 30 * 60 * 1_000;
const TOPAZ_NORMALIZE_TIMEOUT_MS = 20 * 60 * 1_000;

const waitFor = (milliseconds: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, milliseconds))
);

const resolveReplicateFileUrl = (output: any): string => {
  const candidate = Array.isArray(output) ? output[0] : output;
  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate.url === "string") return candidate.url;
  return "";
};

const streamToBuffer = async (body: any): Promise<Buffer> => {
  if (!body) throw new Error("The normalized video file was empty");
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const normalizeTopazVideoToFullHd = async (
  videoBuffer: Buffer,
  targetWidth: 1080 | 1920,
  targetHeight: 1080 | 1920,
): Promise<Buffer> => {
  const rawBytes = await randomBytes(16);
  const jobToken = rawBytes.toString("hex");
  const inputKey = `topaz-normalize/${jobToken}/topaz-${jobToken}.mp4`;
  const outputPrefix = `topaz-normalize/${jobToken}/output/`;
  const outputKey = `${outputPrefix}topaz-${jobToken}-fullhd.mp4`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: inputKey,
      Body: videoBuffer,
      ContentType: "video/mp4",
    }));

    const jobParams: CreateJobCommandInput = {
      Role:
        process.env.MEDIACONVERT_ROLE_ARN ||
        "arn:aws:iam::469269069267:role/MediaConvertRole",
      Settings: {
        TimecodeConfig: { Source: "ZEROBASED" },
        Inputs: [
          {
            FileInput: `s3://${BUCKET_NAME}/${inputKey}`,
            TimecodeSource: "ZEROBASED",
          },
        ],
        OutputGroups: [
          {
            Name: "Topaz Full HD",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: {
                Destination: `s3://${BUCKET_NAME}/${outputPrefix}`,
              },
            },
            Outputs: [
              {
                NameModifier: "-fullhd",
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: { MoovPlacement: "PROGRESSIVE_DOWNLOAD" },
                },
                VideoDescription: {
                  Width: targetWidth,
                  Height: targetHeight,
                  ScalingBehavior: "FILL",
                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "QVBR",
                      MaxBitrate: 12_000_000,
                      QvbrSettings: { QvbrQualityLevel: 9 },
                      AdaptiveQuantization: "HIGH",
                      SceneChangeDetect: "ENABLED",
                      CodecProfile: "HIGH",
                      CodecLevel: "AUTO",
                      FramerateControl: "SPECIFIED",
                      FramerateConversionAlgorithm: "INTERPOLATE",
                      FramerateNumerator: 60,
                      FramerateDenominator: 1,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const createdJob = await mediaConvertClient.send(new CreateJobCommand(jobParams));
    const jobId = createdJob.Job?.Id;
    if (!jobId) throw new Error("Could not start Full HD video normalization");

    const deadline = Date.now() + TOPAZ_NORMALIZE_TIMEOUT_MS;
    let completed = false;
    while (Date.now() < deadline) {
      const job = await mediaConvertClient.send(new GetJobCommand({ Id: jobId }));
      const status = job.Job?.Status;
      if (status === "COMPLETE") {
        completed = true;
        break;
      }
      if (status === "ERROR" || status === "CANCELED") {
        throw new Error(`Full HD video normalization ${String(status).toLowerCase()}`);
      }
      await waitFor(5_000);
    }

    if (!completed) {
      throw new Error("Full HD video normalization timed out");
    }

    const normalizedObject = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: outputKey,
    }));
    const normalizedBuffer = await streamToBuffer(normalizedObject.Body);
    if (normalizedBuffer.length === 0) {
      throw new Error("Full HD video normalization returned an empty file");
    }
    return normalizedBuffer;
  } finally {
    await Promise.allSettled([
      s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: inputKey })),
      s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: outputKey })),
    ]);
  }
};

export function validateVideoUpscaleResolution(req: any, res: any, next: () => void) {
  try {
    const resolution = videoUpscaleResolution(req.body?.targetResolution);
    req.body = { ...req.body, targetResolution: resolution };
    return next();
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}

export async function upscaleVideoRoute(req: any, res: any) {
  let resolution: ReturnType<typeof videoUpscaleResolution>;
  try { resolution = videoUpscaleResolution(req.body?.targetResolution); }
  catch (error: any) { return res.status(400).json({ error: error.message }); }
  const sourceUrl = String(req.body?.video || req.body?.url || "").trim();
  const linkMode = req.body?.linkmode === true;

  if (!sourceUrl) {
    return res.status(400).json({ error: "Missing video URL" });
  }

  try {
    const parsedSourceUrl = new URL(sourceUrl);
    if (parsedSourceUrl.protocol !== "https:" && parsedSourceUrl.protocol !== "http:") {
      return res.status(400).json({ error: "Video must use a public HTTP(S) URL" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid video URL" });
  }

  const replicateToken = process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    return res.status(500).json({ error: "Missing Replicate API token" });
  }

  try {
    console.log(`[BYTEDANCE VIDEO] Starting Standard ${resolution}/60fps upscale`);
    const createResponse = await fetch(VIDEO_UPSCALE_MODEL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${replicateToken}`,
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          video: sourceUrl,
          processing_type: "standard",
          scene: "aigc",
          target_resolution: resolution,
          target_fps: 60,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[BYTEDANCE VIDEO] Replicate create failed:", createResponse.status, errorText);
      let reason = '';
      try {
        const detail = JSON.parse(errorText);
        const value = detail.detail || detail.error || detail.message || '';
        reason = (Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.msg || item?.message || '').filter(Boolean).join('; ')
          : typeof value === 'string' ? value : value?.message || '')
          .replace(/https?:\/\/\S+/g, '[source URL]').slice(0, 500);
      } catch { /* Preserve the provider status if no structured detail exists. */ }
      throw new Error(`Replicate rejected the video upscale (${createResponse.status})${reason ? `: ${reason}` : ''}`);
    }

    let prediction: any = await createResponse.json();
    const predictionId = String(prediction?.id || "");
    if (!predictionId) {
      throw new Error("Replicate did not return a prediction ID");
    }

    const deadline = Date.now() + VIDEO_UPSCALE_TIMEOUT_MS;
    if (linkMode && req.body?.async === true) {
      return res.json({ status: 'starting', jobId: predictionId, provider: 'replicate', modelEndpoint: VIDEO_UPSCALE_MODEL, resolution, targetFps: 60 });
    }
    while (!["succeeded", "failed", "canceled"].includes(String(prediction?.status))) {
      if (Date.now() >= deadline) {
        throw new Error("ByteDance video upscale timed out");
      }

      await waitFor(VIDEO_UPSCALE_POLL_INTERVAL_MS);
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });

      if (!pollResponse.ok) {
        throw new Error(`Could not check ByteDance upscale status (${pollResponse.status})`);
      }

      prediction = await pollResponse.json();
    }

    if (prediction.status !== "succeeded") {
      const providerMessage = String(prediction?.error || `Prediction ${prediction.status}`);
      throw new Error(`ByteDance upscale failed: ${providerMessage}`);
    }

    const resultUrl = resolveReplicateFileUrl(prediction.output);
    if (!resultUrl) {
      throw new Error("ByteDance did not return an output video");
    }

    if (linkMode) {
      console.log("[BYTEDANCE VIDEO] Upscale completed; returning the ByteDance URL");
      return res.json({
        videoUrl: resultUrl,
        predictionId,
        resolution,
        targetResolution: resolution,
        processingType: "standard", scene: "aigc", provider: "replicate",
        targetFps: 60,
      });
    }

    const videoResponse = await fetch(resultUrl);
    if (!videoResponse.ok) {
      throw new Error(`Could not download the ByteDance result (${videoResponse.status})`);
    }

    const upscaledVideoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    if (upscaledVideoBuffer.length === 0) {
      throw new Error("ByteDance returned an empty video");
    }

    // Preserve the provider's exact MP4 output. Running it through MediaConvert here
    // previously removed audio because that job produced only a video track.
    const videoBuffer = upscaledVideoBuffer;

    // Return the same base64 shape as normal video-generation routes. EditStory
    // then uses its existing signed-URL upload, database save, state updates,
    // cache headers, and old-video cleanup without a second persistence path.
    const contentType = "video/mp4";
    const videoBase64 = `data:${contentType};base64,${videoBuffer.toString("base64")}`;
    console.log("[BYTEDANCE VIDEO] Upscale completed; returning the original ByteDance output");

    return res.json({
      videoBase64,
      predictionId,
      resolution,
      targetResolution: resolution,
      processingType: "standard", scene: "aigc", provider: "replicate",
      targetFps: 60,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Video upscale failed";
    console.error("[BYTEDANCE VIDEO] Upscale route failed:", message);
    return res.status(500).json({ error: message });
  }
}
