// src/S3Routes.ts

import { Request, Response } from "express";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, ObjectCannedACL, CopyObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { promisify } from "util";
import fetch from "node-fetch";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { Transform } from "stream";
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

import { HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { isCreationAssetRetained, isCreationLibraryAsset } from './creationDrafts/retention';
import { authenticatedUserId } from './requestAuth';

dotenv.config(); // Load environment variables from .env file

const randomBytes = promisify(crypto.randomBytes);

// Environment Variables
const BUCKET_NAME = process.env.BUCKET_NAME as string;
const REGION = process.env.BUCKET_REGION as string;
const ACCESS_KEY_ID = process.env.BUCKET_ACCESS_KEY as string;
const SECRET_ACCESS_KEY = process.env.BUCKET_SECRET_KEY as string;
const NORMALIZE_IMAGE_MAX_BYTES = Number(process.env.NORMALIZE_IMAGE_MAX_BYTES || 35 * 1024 * 1024);
const NORMALIZE_IMAGE_TIMEOUT_MS = Number(process.env.NORMALIZE_IMAGE_TIMEOUT_MS || 90_000);
const IMMUTABLE_VIDEO_CACHE_CONTROL = "public, max-age=31536000, immutable";

// Initialize S3 Client
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

class NormalizeImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const IMAGE_TYPE_BY_EXT: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const isSupportedRaster = (contentType: string) => contentType !== 'image/svg+xml' && Boolean(IMAGE_EXT_BY_TYPE[contentType]);

const normalizeImagePurpose = (purpose?: string): string => {
  const cleaned = String(purpose || "downloaded-image")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "downloaded-image";
};

const normalizeImageContentType = (value?: string | null, fallbackPath?: string): string => {
  const rawType = String(value || "").split(";")[0].trim().toLowerCase();
  if (rawType.startsWith("image/")) return rawType;

  const ext = String(fallbackPath || "")
    .split("?")[0]
    .split("#")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  return ext && IMAGE_TYPE_BY_EXT[ext] ? IMAGE_TYPE_BY_EXT[ext] : "";
};

const createNormalizedImageKey = async (contentType: string, purpose?: string): Promise<string> => {
  const rawBytes = await randomBytes(16);
  const uniqueName = rawBytes.toString("hex");
  const ext = IMAGE_EXT_BY_TYPE[contentType] || "png";
  return `${normalizeImagePurpose(purpose)}-${uniqueName}.${ext}`;
};

const getPublicS3Url = (key: string): string => {
  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
};

const isPrivateIpAddress = (ip: string): boolean => {
  const lowered = ip.toLowerCase().replace(/^\[|\]$/g, '');
  // IPv4-mapped IPv6 can otherwise bypass the ordinary private-IPv4 checks.
  if (lowered.startsWith('::ffff:')) {
    const mapped = lowered.slice(7);
    if (isIP(mapped) === 4) return isPrivateIpAddress(mapped);
    const parts = mapped.split(':');
    if (parts.length === 2 && parts.every(part => /^[0-9a-f]{1,4}$/.test(part))) {
      const high = parseInt(parts[0], 16), low = parseInt(parts[1], 16);
      return isPrivateIpAddress(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
    }
    return true;
  }
  // Public IPv6 unicast is allocated from 2000::/3. Reject loopback,
  // unspecified, local, link-local and multicast ranges before fetching.
  if (isIP(lowered) === 6) return !/^[23][0-9a-f]{0,3}:/.test(lowered);
  if (lowered.startsWith("127.") || lowered.startsWith("10.") || lowered.startsWith("169.254.")) return true;

  const parts = lowered.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    if (parts[0] === 0 || parts[0] >= 224) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
  }
  return false;
};

const assertPublicHttpImageUrl = async (sourceUrl: URL): Promise<{ address: string; family: number }[]> => {
  if (!["http:", "https:"].includes(sourceUrl.protocol)) {
    throw new NormalizeImageError("Only http, https, and data image URLs are supported.");
  }

  if (sourceUrl.username || sourceUrl.password) throw new NormalizeImageError('Image URLs cannot include credentials.');
  const hostname = sourceUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new NormalizeImageError("Localhost image URLs are not allowed.");
  }

  if (isIP(hostname) && isPrivateIpAddress(hostname)) {
    throw new NormalizeImageError("Private network image URLs are not allowed.");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new NormalizeImageError("Private network image URLs are not allowed.");
  }
  return addresses;
};

const tryGetOwnS3Key = (sourceUrl: string): string | null => {
  if (!BUCKET_NAME || !REGION) return null;

  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    const pathKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    const regionalHost = `${BUCKET_NAME}.s3.${REGION}.amazonaws.com`.toLowerCase();
    const globalHost = `${BUCKET_NAME}.s3.amazonaws.com`.toLowerCase();

    if ((host === regionalHost || host === globalHost) && pathKey) {
      return pathKey;
    }

    const regionalPathHost = `s3.${REGION}.amazonaws.com`.toLowerCase();
    if ((host === regionalPathHost || host === "s3.amazonaws.com") && pathKey.startsWith(`${BUCKET_NAME}/`)) {
      return pathKey.slice(BUCKET_NAME.length + 1);
    }
  } catch {
    return null;
  }

  return null;
};

const createByteLimitTransform = (maxBytes: number): Transform => {
  let totalBytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        callback(new NormalizeImageError("Image download is too large.", 413));
        return;
      }

      callback(null, chunk);
    },
  });
};

const fetchPublicImage = async (sourceUrl: URL, signal: AbortSignal) => {
  let currentUrl = sourceUrl;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const addresses = await assertPublicHttpImageUrl(currentUrl);
    // Pin the validated addresses for this hop. A second DNS resolution by the
    // HTTP client must not turn a public source into a private-network fetch.
    const Agent = currentUrl.protocol === 'https:' ? HttpsAgent : HttpAgent;
    const agent = new Agent({ lookup: ((_host: string, options: any, callback: any) => {
      if (options?.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    }) as any });

    const upstream = await fetch(currentUrl.toString(), {
      redirect: "manual",
      signal: signal as any,
      agent,
      headers: {
        "user-agent": "ClikImageDownloadManager/1.0",
      },
    });

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      (upstream.body as any)?.destroy?.();
      const location = upstream.headers.get("location");
      if (!location) {
        throw new NormalizeImageError("Image download redirect was missing a destination.", 502);
      }

      if (redirectCount === 5) {
        throw new NormalizeImageError("Image download followed too many redirects.", 502);
      }

      currentUrl = new URL(location, currentUrl);
      continue;
    }

    return { upstream, finalUrl: currentUrl };
  }

  throw new NormalizeImageError("Image download followed too many redirects.", 502);
};

const readLimitedBody = async (body: any, maxBytes: number): Promise<Buffer> => {
  if (!body || typeof body[Symbol.asyncIterator] !== "function") {
    throw new NormalizeImageError("Image download returned no body.", 502);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new NormalizeImageError("Image download is too large.", 413);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
};

/** Bounded public-image read shared by server image editors. Redirects receive
 * the same public-network validation as ordinary image imports. */
export async function readPublicImageBytes(source: string, maxBytes = NORMALIZE_IMAGE_MAX_BYTES): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(NORMALIZE_IMAGE_TIMEOUT_MS, 30_000));
  try {
    const parsed = new URL(source);
    if (parsed.username || parsed.password) throw new NormalizeImageError('Image URLs cannot include credentials.');
    const { upstream } = await fetchPublicImage(parsed, controller.signal);
    if (!upstream.ok) throw new NormalizeImageError(`Image download failed with status ${upstream.status}.`, 502);
    const contentLength = Number(upstream.headers.get('content-length'));
    if (contentLength > maxBytes) { (upstream.body as any)?.destroy?.(); throw new NormalizeImageError('Image download is too large.', 413); }
    return await readLimitedBody(upstream.body, maxBytes);
  } finally { clearTimeout(timeout); }
}

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
    const requestedPrefix = String(values.prefix || "hd");
    const allowedPrefixes = new Set(["hd", "upscaled", "denoised"]);
    const uploadPrefix = allowedPrefixes.has(requestedPrefix) ? requestedPrefix : "hd";

    // Generate signed URLs concurrently with public-read ACL so AI models can access them
    const [urlHD] = await Promise.all([generateUploadURL(uploadPrefix, "public-read")]);

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
type NormalizeImageToS3Body = {
  sourceUrl?: string;
  purpose?: string;
};

type DownloadImageForClientBody = {
  sourceUrl?: string;
};

export const DownloadImageForClient = async (
  req: Request<{}, {}, DownloadImageForClientBody>,
  res: Response
): Promise<void> => {
  const sourceUrl = String(req.body?.sourceUrl || "").trim();
  if (!sourceUrl) {
    res.status(400).json({ error: "Missing sourceUrl." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NORMALIZE_IMAGE_TIMEOUT_MS);

  try {
    const ownS3Key = tryGetOwnS3Key(sourceUrl);
    let imageBody: Buffer;
    let contentType: string;

    if (ownS3Key) {
      const object = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: ownS3Key,
      }));

      if (object.ContentLength && object.ContentLength > NORMALIZE_IMAGE_MAX_BYTES) {
        throw new NormalizeImageError("Image download is too large.", 413);
      }

      contentType = normalizeImageContentType(object.ContentType, ownS3Key);
      if (!contentType) {
        throw new NormalizeImageError("Stored object is not a supported image type.", 415);
      }

      imageBody = await readLimitedBody(object.Body, NORMALIZE_IMAGE_MAX_BYTES);
    } else {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(sourceUrl);
      } catch {
        throw new NormalizeImageError("Invalid image URL.");
      }

      const { upstream, finalUrl } = await fetchPublicImage(parsedUrl, controller.signal);
      if (!upstream.ok) {
        throw new NormalizeImageError(`Image download failed with status ${upstream.status}.`, 502);
      }

      const contentLengthHeader = upstream.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
      if (contentLength && contentLength > NORMALIZE_IMAGE_MAX_BYTES) {
        throw new NormalizeImageError("Image download is too large.", 413);
      }

      contentType = normalizeImageContentType(upstream.headers.get("content-type"), finalUrl.pathname);
      if (!contentType) {
        throw new NormalizeImageError("Downloaded URL did not return a supported image type.", 415);
      }

      imageBody = await readLimitedBody(upstream.body, NORMALIZE_IMAGE_MAX_BYTES);
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", imageBody.length);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).send(imageBody);
  } catch (error: any) {
    const isExpected = error instanceof NormalizeImageError;
    const status = isExpected
      ? error.status
      : error?.name === "AbortError"
        ? 504
        : error?.$metadata?.httpStatusCode === 404
          ? 404
          : 502;
    const message = error instanceof Error ? error.message : "Failed to download image.";

    console.error("Failed to download image for client:", message);
    res.status(status).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
};

export type NormalizedImageCommit = (imageUrl: string, upload: () => Promise<unknown>) => Promise<void>;

/** Shared storage path: provider output is uploaded before its consumer is updated.
 * A commit hook can durably record cleanup before the S3 write starts. */
export async function storeNormalizedImage(sourceUrl: string, purpose?: string, requireRaster = false, commit?: NormalizedImageCommit) {
  if (!sourceUrl || !BUCKET_NAME || !REGION) throw new NormalizeImageError("Missing image or S3 configuration.");
  const trimmedSourceUrl = sourceUrl.trim();

    if (trimmedSourceUrl.startsWith("data:")) {
      const match = trimmedSourceUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        throw new NormalizeImageError("Only base64 data image URLs are supported.");
      }

      const contentType = normalizeImageContentType(match[1]);
      if (!contentType || (requireRaster && !isSupportedRaster(contentType))) {
        throw new NormalizeImageError("Unsupported image content type.");
      }

      const imageBody = Buffer.from(match[2], "base64");
      if (imageBody.length > NORMALIZE_IMAGE_MAX_BYTES) {
        throw new NormalizeImageError("Image download is too large.", 413);
      }

      const key = await createNormalizedImageKey(contentType, purpose);
      const imageUrl = getPublicS3Url(key);
      const upload = () => s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: imageBody,
        ContentType: contentType,
        ContentLength: imageBody.length,
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      }));
      if (commit) await commit(imageUrl, upload); else await upload();
      return { imageUrl, url: imageUrl, key, contentType, method: "data" };
    }

    const existingS3Key = tryGetOwnS3Key(trimmedSourceUrl);
    if (existingS3Key) {
      const head = await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: existingS3Key,
      }));

      if (head.ContentLength && head.ContentLength > NORMALIZE_IMAGE_MAX_BYTES) {
        throw new NormalizeImageError("Image download is too large.", 413);
      }

      const contentType = normalizeImageContentType(head.ContentType, existingS3Key) || "image/png";
      const key = await createNormalizedImageKey(contentType, purpose);
      const copySource = `${BUCKET_NAME}/${existingS3Key.split("/").map(encodeURIComponent).join("/")}`;
      const imageUrl = getPublicS3Url(key);
      const upload = () => s3Client.send(new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        CopySource: copySource,
        ContentType: contentType,
        MetadataDirective: "REPLACE",
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      }));
      if (commit) await commit(imageUrl, upload); else await upload();
      return { imageUrl, url: imageUrl, key, contentType, method: "copy" };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedSourceUrl);
    } catch {
      throw new NormalizeImageError("Invalid image URL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NORMALIZE_IMAGE_TIMEOUT_MS);

    try {
      const { upstream, finalUrl } = await fetchPublicImage(parsedUrl, controller.signal);

      if (!upstream.ok) {
        throw new NormalizeImageError(`Image download failed with status ${upstream.status}.`, 502);
      }

      const contentLengthHeader = upstream.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
      if (contentLength && contentLength > NORMALIZE_IMAGE_MAX_BYTES) {
        throw new NormalizeImageError("Image download is too large.", 413);
      }

      const contentType = normalizeImageContentType(upstream.headers.get("content-type"), requireRaster ? undefined : finalUrl.pathname);
      if (!contentType || (requireRaster && !isSupportedRaster(contentType))) {
        throw new NormalizeImageError("Downloaded URL did not return a supported image type.", 415);
      }

      if (!upstream.body) {
        throw new NormalizeImageError("Image download returned no body.", 502);
      }

      const key = await createNormalizedImageKey(contentType, purpose);
      const imageUrl = getPublicS3Url(key);
      const upload = () => s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: upstream.body!.pipe(createByteLimitTransform(NORMALIZE_IMAGE_MAX_BYTES)) as any,
          ContentType: contentType,
          ...(contentLength ? { ContentLength: contentLength } : {}),
          ACL: "public-read",
          CacheControl: "public, max-age=31536000, immutable",
        }));
      try { if (commit) await commit(imageUrl, upload); else await upload(); }
      catch (error) { controller.abort(); throw error; }
      return { imageUrl, url: imageUrl, key, contentType, method: "download" };
    } finally {
      clearTimeout(timeout);
    }
 }

export async function assertStoredTemplateImage(url: string): Promise<void> {
  const key = tryGetOwnS3Key(url);
  if (!key) throw new NormalizeImageError("Template covers must be stored in the application bucket.");
  const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  if (!String(head.ContentType || '').startsWith('image/')) throw new NormalizeImageError("Cover upload is not an image.");
}

/** Copy a World image without turning an unreadable bucket object into public media. */
export async function copyPublicWorldImage(url: string, purpose: string): Promise<string> {
  const canonical = postMediaStorageUrl(url);
  if (!canonical) {
    if (!/^https?:\/\//i.test(url.trim())) throw new NormalizeImageError("Choose a public image.");
    return (await storeNormalizedImage(url, purpose, true)).url;
  }
  const source = parseS3Uri(canonical);
  const encodedKey = source.Key.split('/').map(encodeURIComponent).join('/');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NORMALIZE_IMAGE_TIMEOUT_MS);
  try {
    const available = await fetch(getPublicS3Url(encodedKey), { method: 'HEAD', redirect: 'error', signal: controller.signal });
    const contentType = normalizeImageContentType(available.headers.get('content-type'));
    const length = Number(available.headers.get('content-length'));
    const etag = available.headers.get('etag');
    if (!available.ok || !isSupportedRaster(contentType) || !etag || !length || length > NORMALIZE_IMAGE_MAX_BYTES) {
      throw new NormalizeImageError("Choose a readable image within the upload size limit.");
    }
    const key = await createNormalizedImageKey(contentType, purpose);
    await s3Client.send(new CopyObjectCommand({
      Bucket: source.Bucket,
      Key: key,
      CopySource: `${source.Bucket}/${encodedKey}`,
      CopySourceIfMatch: etag,
      ContentType: contentType,
      MetadataDirective: 'REPLACE',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return getPublicS3Url(key);
  } finally {
    clearTimeout(timeout);
  }
}

export const NormalizeImageToS3 = async (req: Request<{}, {}, NormalizeImageToS3Body>, res: Response): Promise<void> => {
  try { res.json(await storeNormalizedImage(String(req.body?.sourceUrl || ''), req.body?.purpose)); }
  catch (error: any) { res.status(error instanceof NormalizeImageError ? error.status : 502).json({ error: error?.message || 'Failed to normalize image.' }); }
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

/** Short-lived access for private H3 outputs; never persist this URL in a scene. */
export async function generateH3VideoReadURL(key: string): Promise<string> {
  if (!/^modal-h3-video-[a-f0-9]{32}\.mp4$/.test(key)) {
    throw new Error("Invalid MiniMax H3 output key.");
  }
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }), { expiresIn: 8000 });
}

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
    CacheControl: IMMUTABLE_VIDEO_CACHE_CONTROL,
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
    console.error("Error creating signed‑delete URL:", error);
    res.status(500).json({ error: "Failed to create signed‑delete URL" });
  }
};

/* ──────────────── DELETE-IMAGE HELPERS ─────────────────────────── */

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

/** Only this app's stored objects are deletable; provider URLs are references. */
export function postMediaStorageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(?:https?:\/\/|s3:\/\/)/i.test(value.trim())) return null;
  if (!BUCKET_NAME) throw new Error('Missing media storage configuration.');
  try {
    const url = new URL(value.trim());
    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const host = url.hostname.toLowerCase(), bucket = BUCKET_NAME.toLowerCase();
    if (url.protocol === 's3:') {
      if (host !== bucket) return null;
    } else if (host.startsWith(`${bucket}.s3`) && /^(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host.slice(`${bucket}.s3`.length))) {
      // Regional and global virtual-host URLs use the same object key.
    } else if (/^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host) && key.startsWith(`${BUCKET_NAME}/`)) {
      key = key.slice(BUCKET_NAME.length + 1);
    } else return null;
    return key ? `s3://${BUCKET_NAME}/${key}` : null;
  } catch { return null; }
}

/** Independent, deterministic server-side copy for an authorized frozen remix. */
export async function copyCreationMediaObject(sourceUrl: string, creationId: string, assetId: string): Promise<string> {
  const canonical = postMediaStorageUrl(sourceUrl);
  if (!canonical || !/^[a-f0-9]{64}$/.test(assetId)) throw new Error('Invalid stored remix media.');
  const source = parseS3Uri(canonical);
  const original = await s3Client.send(new HeadObjectCommand(source));
  if (Number(original.ContentLength) > 5 * 1024 * 1024 * 1024) throw new Error('Remix media exceeds the supported single-copy size.');
  const extension = source.Key.match(/\.([A-Za-z0-9]{1,12})$/)?.[1]?.toLowerCase() || 'bin';
  const key = `creation/${creationId.replace(/[^A-Za-z0-9_-]/g, '_')}/${assetId}.${extension}`;
  try {
    const present = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    if (present.Metadata?.creation_copy_source === assetId && present.ContentLength === original.ContentLength) return getPublicS3Url(key);
  } catch (error: any) { if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound' && error?.name !== 'NoSuchKey') throw error; }
  await s3Client.send(new CopyObjectCommand({ Bucket: BUCKET_NAME, Key: key,
    CopySource: `${source.Bucket}/${source.Key.split('/').map(encodeURIComponent).join('/')}`,
    CopySourceIfMatch: original.ETag,
    MetadataDirective: 'REPLACE',
    ContentType: original.ContentType || 'application/octet-stream',
    CacheControl: IMMUTABLE_VIDEO_CACHE_CONTROL,
    ...(original.ContentDisposition ? { ContentDisposition: original.ContentDisposition } : {}),
    Metadata: { ...original.Metadata, creation_copy_source: assetId },
    // Match the normal upload helpers: images/audio are directly GET-able;
    // videos use the application's existing private-object delivery policy.
    ACL: /^(?:image|audio)\//.test(original.ContentType || '') ? 'public-read' : 'private',
  }));
  const copied = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  if (copied.ContentLength !== original.ContentLength || copied.Metadata?.creation_copy_source !== assetId) throw new Error('Remix media copy could not be verified.');
  return getPublicS3Url(key);
}

/** Preserve stored draft and library media even if an old client queues its URL. */
async function creationCleanupAllowed(req: Request, res: Response, url: string): Promise<boolean> {
  if (!authenticatedUserId(req)) { res.status(401).json({ error: 'Please sign in.' }); return false; }
  const canonical = postMediaStorageUrl(url);
  if (!canonical) { res.status(400).json({ error: 'Only this application\'s stored media can be deleted.' }); return false; }
  if (await isCreationAssetRetained(canonical) || await isCreationLibraryAsset(canonical)) {
    res.status(409).json({ code: 'MEDIA_RETAINED', error: 'This media belongs to a saved creation or library asset.' });
    return false;
  }
  return true;
}

export const deleteCloudAudioUrl = async (
  url: string
): Promise<{ Bucket: string; Key: string }> => {
  if (!url) {
    throw new Error("Missing audio URL.");
  }

  const parts = parseS3Uri(toS3Uri(url));
  const canonical = postMediaStorageUrl(url);
  if (canonical && await isCreationAssetRetained(canonical)) return parts;
  const head = await s3Client.send(new HeadObjectCommand(parts));
  const ct = head.ContentType ?? "";

  if (!ct.startsWith("audio/")) {
    throw new Error(`Not an audio file (Content-Type=${ct})`);
  }

  await s3Client.send(new DeleteObjectCommand(parts));
  console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

  return parts;
};

/* ──────────────── DELETE-IMAGE ROUTE HANDLER ───────────────────── */

export const deleteCloudImageUrl = async (
  url: string,
  options?: { retainedAssetAuthorized?: boolean }
): Promise<{ Bucket: string; Key: string }> => {
  if (!url) {
    throw new Error("Missing image URL.");
  }

  const parts = parseS3Uri(toS3Uri(url));
  const canonical = postMediaStorageUrl(url);
  if (!options?.retainedAssetAuthorized && canonical && await isCreationAssetRetained(canonical)) return parts;
  await s3Client.send(new DeleteObjectCommand(parts));
  console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

  return parts;
};

export const deleteCloudVideoUrl = async (
  url: string
): Promise<{ Bucket: string; Key: string }> => {
  if (!url) {
    throw new Error("Missing video URL.");
  }

  const parts = parseS3Uri(toS3Uri(url));
  const canonical = postMediaStorageUrl(url);
  if (canonical && await isCreationAssetRetained(canonical)) return parts;
  await s3Client.send(new DeleteObjectCommand(parts));
  console.log(`Deleted s3://${parts.Bucket}/${parts.Key}`);

  return parts;
};
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
    if (!await creationCleanupAllowed(req, res, url)) return;
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

  try {
    if (!await creationCleanupAllowed(req, res, url)) return;
    const deleted = await deleteCloudVideoUrl(url);
    res.json({ message: "Video deleted.", deleted });
  } catch (err: any) {
    console.error("DelCloudVideo error:", err);
    const status = err.name === "NotFound" ? 404 : /valid S3 URL|Missing video URL/.test(err.message) ? 400 : 500;
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

  try {
    if (!await creationCleanupAllowed(req, res, url)) return;
    const deleted = await deleteCloudAudioUrl(url);
    res.json({ message: "Audio deleted.", deleted });
    return;
  } catch (err: any) {
    console.error("DelCloudAudio error:", err);
    const status = err.name === "NotFound" ? 404 : 500;
    res.status(status).json({ error: err.message });
    return;
  }
};
