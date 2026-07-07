// import { Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { promisify } from "util";

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
    const { url, size } = req.body;

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
