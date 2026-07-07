import { Request, Response, Router } from "express";
import AWS from "aws-sdk";
import { randomUUID } from "crypto";

const router = Router();

const region = process.env.AWS_REGION || "us-east-1";
const lambdaFunctionName = process.env.LAMBDA_FFMPEG_FUNCTION_NAME || "clikb-ffmpeg";
const statusBucket = process.env.LAMBDA_STATUS_BUCKET || process.env.OUTPUT_BUCKET || "clikbatebucket";
const statusPrefix = process.env.LAMBDA_STATUS_PREFIX || "lambda-ffmpeg-status/";
const outputBucket = process.env.LAMBDA_OUTPUT_BUCKET || process.env.OUTPUT_BUCKET || "clikbatebucket";
const outputPrefix = process.env.LAMBDA_OUTPUT_PREFIX || "lambda-ffmpeg/";

AWS.config.update({ region });

const lambda = new AWS.Lambda();
const s3 = new AWS.S3();

router.post("/lambdaFfmpeg/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const recipe = req.body?.recipe || req.body;
    if (!recipe || !Array.isArray(recipe.scenes) || recipe.scenes.length === 0) {
      res.status(400).json({ error: "Missing Lambda recipe scenes." });
      return;
    }

    const jobId = String(recipe.jobId || randomUUID());
    const statusKey = `${statusPrefix}${jobId}.json`;

    const output = {
      ...(recipe.output || {}),
      bucket: recipe.output?.bucket || outputBucket,
      prefix: recipe.output?.prefix || outputPrefix,
      filename: recipe.output?.filename || `post_${recipe.postId || "unknown"}_${jobId}.mp4`,
    };

    const lambdaPayload = {
      ...recipe,
      jobId,
      output,
      status: {
        bucket: statusBucket,
        key: statusKey,
      },
    };

    const queuedStatus = {
      jobId,
      postId: recipe.postId || null,
      state: "queued",
      stage: "queued",
      progress: 0,
      message: "Lambda render job queued.",
      updatedAt: new Date().toISOString(),
    };

    await s3
      .putObject({
        Bucket: statusBucket,
        Key: statusKey,
        Body: JSON.stringify(queuedStatus),
        ContentType: "application/json",
      })
      .promise();

    console.log("Starting Lambda FFmpeg job:", {
      jobId,
      functionName: lambdaFunctionName,
      statusBucket,
      statusKey,
      output,
    });

    await lambda
      .invoke({
        FunctionName: lambdaFunctionName,
        InvocationType: "Event",
        Payload: JSON.stringify(lambdaPayload),
      })
      .promise();

    res.json({
      jobId,
      statusBucket,
      statusKey,
      output,
      message: "Lambda FFmpeg job started.",
    });
  } catch (error: any) {
    console.error("Failed to start Lambda FFmpeg job:", error);
    res.status(500).json({
      error: "Failed to start Lambda FFmpeg job",
      details: error?.message || String(error),
    });
  }
});

router.post("/lambdaFfmpeg/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const bucket = req.body?.statusBucket || statusBucket;
    const key = req.body?.statusKey;

    if (!key) {
      res.status(400).json({ error: "Missing statusKey." });
      return;
    }

    const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const body = await streamBodyToString(response.Body);
    const status = JSON.parse(body);

    res.json(status);
  } catch (error: any) {
    if (error?.code === "NoSuchKey") {
      res.status(404).json({ error: "Status not found yet." });
      return;
    }

    console.error("Failed to poll Lambda FFmpeg status:", error);
    res.status(500).json({
      error: "Failed to poll Lambda FFmpeg status",
      details: error?.message || String(error),
    });
  }
});

async function streamBodyToString(body: AWS.S3.Body | undefined): Promise<string> {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");

  const chunks: Buffer[] = [];
  const stream = body as NodeJS.ReadableStream;

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export default router;
