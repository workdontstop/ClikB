// src/S3Routes.ts

import { Request, Response } from "express";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { promisify } from "util";

import { HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

dotenv.config(); // Load environment variables from .env file

const randomBytes = promisify(crypto.randomBytes);

// Environment Variables
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

const normalizeRagInstructionIdForS3 = (ragId: string): string => {
  const safeRagId = String(ragId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!safeRagId) {
    throw new Error("Missing valid RAG id for S3 operation");
  }

  return safeRagId;
};

export const getRagInstructionS3Key = (ragId: string): string => {
  return `rag/instructions/${normalizeRagInstructionIdForS3(ragId)}.rag.txt`;
};
/**
 * Generates a signed URL for uploading to S3.
 * @param prefix Optional prefix to differentiate between image types (e.g., 'base', 'hd').
 * @returns Signed URL as a string.
 */
export async function generateUploadURL(prefix: string = "", acl: ObjectCannedACL | string = "private"): Promise<string> {
  const rawBytes = await randomBytes(16);
  const uniqueName = rawBytes.toString("hex");
  const fileName = prefix ? `${prefix}-${uniqueName}.png` : `${uniqueName}.png`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: "image/png",
    ACL: acl as ObjectCannedACL,
  });

  // Set the expiration time (e.g., 8000 seconds)
  const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 8000 });

  return uploadURL;
}

/**
 * Handles POST requests to generate signed URLs for base and HD images.
 * Endpoint: /get_signed_url_image
 */

export async function uploadRagInstructionToS3(
  ragId: string,
  instructions: string
): Promise<{ bucket: string; key: string; url: string }> {
  if (!BUCKET_NAME || !REGION) {
    throw new Error("Missing S3 bucket configuration for RAG upload");
  }

  const key = getRagInstructionS3Key(ragId);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: Buffer.from(instructions, "utf8"),
    ContentType: "text/plain; charset=utf-8",
    ACL: "private",
  });

  await s3Client.send(command);

  return {
    bucket: BUCKET_NAME,
    key,
    url: `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`,
  };
}

export async function deleteRagInstructionFromS3(
  ragId: string
): Promise<{ bucket: string; key: string }> {
  if (!BUCKET_NAME || !REGION) {
    throw new Error("Missing S3 bucket configuration for RAG delete");
  }

  const key = getRagInstructionS3Key(ragId);
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));

  return {
    bucket: BUCKET_NAME,
    key,
  };
}

export const SignedUrl = async (req: Request, res: Response): Promise<void> => {
  const { values } = req.body;

  // Validate the request payload
  if (!values || values.count !== 2) {
    res
      .status(400)
      .json({ error: "Invalid request payload. 'count' must be 2." });
    return;
  }

  try {
    // Generate signed URLs concurrently
    const [urlBase, urlHD] = await Promise.all([
      generateUploadURL("base"),
      generateUploadURL("hd"),
    ]);

    // Structure the response
    const holder = [
      {
        urlBase,
        urlHD,
      },
    ];

    res.json({ holder });
    console.log("Signed URLs generated successfully:", holder);
  } catch (error) {
    console.error("Error generating signed URLs:", error);
    res.status(500).json({ error: "Failed to generate signed URLs" });
  }
};

export const SignedUrlStory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { values } = req.body;

  // Validate the request payload
  if (!values || values.count !== 1) {
    res
      .status(400)
      .json({ error: "Invalid request payload. 'count' must be 1." });
    return;
  }

  try {
    // Generate signed URLs concurrently with public-read ACL so AI models can access them
    const [urlHD] = await Promise.all([generateUploadURL("hd", "public-read")]);

    // Structure the response
    const holder = [
      {
        urlHD,
      },
    ];

    res.json({ holder });
    console.log("Signed URLs generated successfully:", holder);
  } catch (error) {
    console.error("Error generating signed URLs:", error);
    res.status(500).json({ error: "Failed to generate signed URLs" });
  }
};

export async function generateUploadURLAudio(
  prefix: string = "audio"
): Promise<string> {
  const rawBytes = await randomBytes(16);
  const uniqueName = rawBytes.toString("hex");
  // We'll name it something like "audio-<hex>.mp3"
  const fileName = `${prefix}-${uniqueName}.mp3`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: "audio/mpeg", // mp3 MIME so downstream can read it correctly
    ACL: "public-read", // make object GET-able by Replicate
    CacheControl: "public, max-age=31536000, immutable",
  });

  // Signed PUT URL for uploading from the client (valid ~8000s)
  const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 8000 });

  return uploadURL;
}

export async function generateUploadURLAudiox(
  prefix: string = "audio",
  ext: any
): Promise<any> {
  const rawBytes = await randomBytes(16);
  const uniqueName = rawBytes.toString("hex");
  // We'll name it something like "audio-<hex>.mp3"
  const fileName = `${prefix}-${uniqueName}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: `audio/${ext}`, // mp3 MIME so downstream can read it correctly
    ACL: "public-read", // make object GET-able by Replicate
    CacheControl: "public, max-age=31536000, immutable",
  });

  // Signed PUT URL for uploading from the client (valid ~8000s)
  const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 8000 });

  return uploadURL;
}

export const SignedUrlAudiox = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Safely unwrap payload whether it's { values: {...} } or flattened
  const payload: any =
    req.body && typeof req.body.values === "object"
      ? req.body.values
      : req.body || {};

  const count = Number(payload.count ?? 1);
  const ext = (payload.ext || "").toLowerCase();
  ///const contentType = (payload.contentType || "").toLowerCase();

  if (count !== 1) {
    res
      .status(400)
      .json({ error: "Invalid request payload. 'count' must be 1." });
    return;
  }
  if (!ext) {
    res.status(400).json({ error: "Missing 'ext' in values." });
    return;
  }

  try {
    const [urlAudio] = await Promise.all([
      generateUploadURLAudiox("audio", ext),
    ]);

    const holder = [{ urlAudio }];
    res.json({ holder });
    console.log("Signed URLs for audio generated successfully:", holder);
  } catch (error) {
    console.error("Error generating signed URLs for audio:", error);
    res.status(500).json({ error: "Failed to generate signed URLs for audio" });
  }
};

export const SignedUrlAudio = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { values } = req.body;

  // For example, you might expect { values: { count: 1 } }
  if (!values || values.count !== 1) {
    res
      .status(400)
      .json({ error: "Invalid request payload. 'count' must be 1." });
    return;
  }

  try {
    // Generate signed URLs concurrently, if you need multiple;
    // for now we assume it's just 1 => [urlAudio]
    const [urlAudio] = await Promise.all([generateUploadURLAudio()]);

    // Structure the response
    const holder = [
      {
        urlAudio,
      },
    ];

    res.json({ holder });
    console.log("Signed URLs for audio generated successfully:", holder);
  } catch (error) {
    console.error("Error generating signed URLs for audio:", error);
    res.status(500).json({ error: "Failed to generate signed URLs for audio" });
  }
};

export async function generateUploadURLVideo(
  prefix: string = "video"
): Promise<string> {
  const rawBytes = await randomBytes(16);
  const uniqueName = rawBytes.toString("hex");

  // Example: "video-<hex>.mp4"
  const fileName = `${prefix}-${uniqueName}.mp4`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: "video/mp4", // Let S3 know it's an mp4
    ACL: "private", // or "public-read" if you want it publicly accessible
  });

  // Signed URL expires in 8000 seconds (~2.2 hours). Adjust as needed.
  const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 8000 });
  return uploadURL;
}

/**
 * Express handler for generating a signed URL to upload a video to S3.
 * Expects a JSON body like: { "values": { "count": 1 } }
 * Responds with: { "holder": [ { "urlVideo": "<signed URL>" } ] }
 */
export const SignedUrlVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { values } = req.body;

  // Validate the request payload
  if (!values || values.count !== 1) {
    res
      .status(400)
      .json({ error: "Invalid request payload. 'count' must be 1." });
    return;
  }

  try {
    // Generate the signed URL (or multiple if needed)
    const [urlVideo] = await Promise.all([generateUploadURLVideo()]);

    // Structure the response
    const holder = [
      {
        urlVideo,
      },
    ];

    res.json({ holder });
    console.log("Signed URL for video generated successfully:", holder);
  } catch (error) {
    console.error("Error generating signed URLs for video:", error);
    res.status(500).json({ error: "Failed to generate signed URLs for video" });
  }
};

// ---------------- helper ----------------
export async function generateDeleteURLVideo(
  key: string,
  expiresIn = 600 // seconds
): Promise<string> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// ------------- route handler ------------
export const SignedDeleteUrlVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { key } = req.body;

  if (!key) {
    res.status(400).json({ error: "Missing object key to delete." });
    return;
  }

  try {
    const deleteUrl = await generateDeleteURLVideo(key);

    // match your existing response shape
    const holder = [{ deleteUrl }];

    res.json({ holder });
    console.log("Signed DELETE URL generated:", holder);
  } catch (error) {
    console.error("Error creating signedâ€‘delete URL:", error);
    res.status(500).json({ error: "Failed to create signedâ€‘delete URL" });
  }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DELETE-IMAGE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function toS3Uri(url: string): string {
  const base = url.split("?")[0];
  if (base.startsWith("s3://")) return base;

  const m = base.match(
    /^https?:\/\/([^/.]+)\.s3[.-][^/]+\.amazonaws\.com\/(.+)$/
  );
  if (m) return `s3://${m[1]}/${m[2]}`;

  throw new Error("Must be a valid S3 URL or s3:// URI");
}

function parseS3Uri(uri: string): { Bucket: string; Key: string } {
  const [, bucket, key] = uri.match(/^s3:\/\/([^/]+)\/(.+)$/)!;
  return { Bucket: bucket, Key: key };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DELETE-IMAGE ROUTE HANDLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export const DelCloudImage = async (
  req: Request<{}, {}, { url?: string }>,
  res: Response
): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: "Missing `url` in request body." });
    return;
  }

  // 1) normalise & split into bucket/key
  let parts: { Bucket: string; Key: string };
  try {
    parts = parseS3Uri(toS3Uri(url));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  try {
    // 2) delete the object
    await s3Client.send(new DeleteObjectCommand(parts));
    console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

    res.json({ message: "Image deleted." });
  } catch (err: any) {
    console.error("DelCloudImage error:", err);
    const status = err.name === "NotFound" ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

/**
 * POST /del-video
 * Body: { url: "https://your-bucket.s3.amazonaws.com/path/to/video.mp4" }
 */
export const DelCloudVideo = async (
  req: Request<{}, {}, { url?: string }>,
  res: Response
): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: "Missing `url` in request body." });
    return;
  }

  // 1) normalise URL â†’ s3:// and split into Bucket / Key
  let parts: { Bucket: string; Key: string };
  try {
    parts = parseS3Uri(toS3Uri(url));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  try {
    // 2) delete the object
    await s3Client.send(new DeleteObjectCommand(parts));
    console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

    res.json({ message: "Video deleted." });
  } catch (err: any) {
    console.error("DelCloudVideo error:", err);
    const status = err.name === "NotFound" ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

/**
 * POST /del-audio
 * Body: { url: "https://your-bucket.s3.amazonaws.com/path/to/file.mp3" }
 */
export const DelCloudAudio = async (
  req: Request<{}, {}, { url?: string }>,
  res: Response
): Promise<void> => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: "Missing `url` in request body." });
    return;
  }

  // 1) Normalize & split into bucket/key
  let parts: { Bucket: string; Key: string };
  try {
    parts = parseS3Uri(toS3Uri(url));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  try {
    // 2) (optional) verify itâ€™s an audio/*
    const head = await s3Client.send(new HeadObjectCommand(parts));
    const ct = head.ContentType ?? "";
    if (!ct.startsWith("audio/")) {
      res.status(400).json({ error: `Not an audio file (Content-Type=${ct})` });
      return;
    }

    // 3) delete it
    await s3Client.send(new DeleteObjectCommand(parts));
    console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

    res.json({ message: "Audio deleted." });
    return;
  } catch (err: any) {
    console.error("DelCloudAudio error:", err);
    const status = err.name === "NotFound" ? 404 : 500;
    res.status(status).json({ error: err.message });
    return;
  }
};
