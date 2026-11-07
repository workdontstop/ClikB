import type { NextFunction, Request, RequestHandler, Response } from "express";
import { randomUUID } from "crypto";
import { getPixelsForUser } from "./db";
import execQuery, { withTransaction } from "./execQuery";
import { recordPixelCharge, setUsageAction } from "./aiUsageLedger";
import { authenticatedOwnerId, authenticatedUserId } from "./requestAuth";
import { mediaChargeFor } from "./mediaPricing";
import { templateCoverQualityForRoute } from './templateCoverModels';
import { attachMeasuredSourceDuration } from "./sourceMediaDuration";
import { profileImageTarget, signProfileImageReceipt, verifyProfileImageReceipt, type ProfileImageTarget } from './profileImageReceipt';

type MediaHandler = (req: Request, res: Response, next: NextFunction) => any;
type CapturedResponse = { kind: "json" | "send"; body: any };

type MediaJobRow = {
  job_key: string;
  provider: string;
  provider_job_id: string;
  user_id: string | number;
  route: string;
  pixels: number;
  action_label: string;
  model_endpoint: string | null;
  status: string;
  charged_at: Date | string | null;
};

const ACTION_LABELS: Record<string, string> = {
  "preview-image": "Preview Image",
  "scene-image": "Scene Image",
  "image-recreate": "Image Recreate",
  "character-image": "Character Image",
  "environment-image": "Environment Image",
  "brainstorm-image": "Brainstorm Image",
  "style-image": "Style Image",
  "sketch-upgrade": "Sketch Upgrade",
  "visual-guide": "Visual Guide",
  "guide-update": "Guide Update",
  "b-shot-image": "B-Shot Image",
  "image-upscale": "Image Upscale",
  "image-denoise": "Image Denoise",
  "youtube-thumbnail": "YouTube Thumbnail",
  "world-character": "Character Image",
  "profile-avatar": "Profile Picture",
  "profile-cover": "Profile Cover",
  "scene-video": "Scene Video",
  "forward-video": "Forward Video",
  "return-video": "Return Video",
  "b-shot-video": "B-Shot Video",
  "video-upscale": "Video Upscale",
  "lip-sync-pro": "Lip Sync Pro",
};

const safeText = (value: unknown, maxLength: number): string =>
  String(value || "").replace(/[\r\n\u0000-\u001f]+/g, " ").trim().slice(0, maxLength);

const actionLabelFor = (body: any, fallback: string): string => {
  const base = ACTION_LABELS[safeText(body?.billingAction, 40)] || fallback;
  const scene = Math.floor(Number(body?.billingScene));
  const reference = safeText(body?.billingReference, 48);
  if (Number.isFinite(scene) && scene > 0 && scene <= 10000) return `${base} · Scene ${scene}`;
  if (reference && /^(Character Image|Environment Image)$/.test(base)) return `${base} · ${reference}`;
  return base;
};

const jobKey = (provider: unknown, providerJobId: unknown): string =>
  `${safeText(provider, 64).toLowerCase()}:${safeText(providerJobId, 255)}`;

const setBillingHeaders = (
  res: Response,
  pixels: number,
  balance: number,
  label: string,
): void => {
  res.setHeader("X-ClikB-Pixels-Charged", String(Math.max(0, pixels)));
  res.setHeader("X-ClikB-Pixels-Balance", String(Math.max(0, balance)));
  res.setHeader("X-ClikB-Billing-Label", encodeURIComponent(label));
  res.setHeader("X-ClikB-Billing-Stage", label.includes("Video") || label.startsWith("Lip Sync Pro") ? "video_generation" : "image_generation");
};

const installCapture = (res: Response): {
  read: () => CapturedResponse | null;
  restore: () => void;
  release: (captured: CapturedResponse) => Response;
} => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let captured: CapturedResponse | null = null;

  (res as any).json = (body: any) => {
    captured = { kind: "json", body };
    return res;
  };
  (res as any).send = (body: any) => {
    captured = { kind: "send", body };
    return res;
  };

  const restore = () => {
    (res as any).json = originalJson;
    (res as any).send = originalSend;
  };

  return {
    read: () => captured,
    restore,
    release: (value) => value.kind === "json" ? originalJson(value.body) : originalSend(value.body),
  };
};

const insufficient = async (res: Response, userId: string, pixels: number, label: string): Promise<Response> => {
  const balance = Number(await getPixelsForUser(userId)) || 0;
  return res.status(402).json({
    message: `Not enough pixels. ${label} needs ${pixels} P and you have ${balance} P.`,
    pixels: balance,
    required: pixels,
  });
};

const isSuccessfulMedia = (body: any, kind: "image" | "video"): boolean => {
  if (!body || body.error) return false;
  if (kind === "image") {
    return Boolean(body.imageBase64 || body.imageUrl || body.image || body.url || body.images?.length);
  }
  return Boolean(body.videoBase64 || body.videoUrl || body.url);
};

const reserveMediaRequest = async (
  userId: string,
  route: string,
  pixels: number,
  label: string,
): Promise<MediaJobRow | null> => withTransaction(async (query) => {
  const memberRows = await query(
    "SELECT COALESCE(pixels, 0) AS pixels FROM members WHERE id = ? FOR UPDATE",
    [userId],
  );
  const balance = Number(memberRows?.[0]?.pixels) || 0;
  if (!memberRows?.[0]) return null;

  await query(
    `UPDATE media_generation_jobs
       SET status = 'expired'
     WHERE user_id = ?
       AND charged_at IS NULL
       AND status IN ('reserved', 'pending', 'processing')
       AND created_at < (CURRENT_TIMESTAMP - INTERVAL 6 HOUR)`,
    [userId],
  );
  const heldRows = await query(
    `SELECT COALESCE(SUM(pixels), 0) AS pixels
       FROM media_generation_jobs
      WHERE user_id = ?
        AND charged_at IS NULL
        AND status IN ('reserved', 'pending', 'processing')`,
    [userId],
  );
  const held = Number(heldRows?.[0]?.pixels) || 0;
  if ((balance - held) < pixels) return null;

  const reservationId = randomUUID();
  const key = `reservation:${reservationId}`;
  await query(
    `INSERT INTO media_generation_jobs
      (job_key, provider, provider_job_id, user_id, route, pixels, action_label, model_endpoint, status)
     VALUES (?, 'reservation', ?, ?, ?, ?, ?, NULL, 'reserved')`,
    [key, reservationId, userId, route, pixels, label],
  );
  return {
    job_key: key,
    provider: "reservation",
    provider_job_id: reservationId,
    user_id: userId,
    route,
    pixels,
    action_label: label,
    model_endpoint: null,
    status: "reserved",
    charged_at: null,
  };
});

const activateAsyncJob = async (
  reservation: MediaJobRow,
  responseBody: any,
): Promise<void> => {
  const provider = safeText(responseBody?.provider, 64).toLowerCase();
  const providerJobId = safeText(responseBody?.jobId, 255);
  const key = jobKey(provider, providerJobId);
  if (!provider || !providerJobId || key.length > 512) throw new Error("Video provider returned an invalid asynchronous job identity.");
  const result = await execQuery(
    `UPDATE media_generation_jobs
        SET job_key = ?, provider = ?, provider_job_id = ?, model_endpoint = ?, status = 'pending'
      WHERE job_key = ? AND user_id = ? AND status = 'reserved'`,
    [
      key,
      provider,
      providerJobId,
      safeText(responseBody?.modelEndpoint, 255) || null,
      reservation.job_key,
      reservation.user_id,
    ],
  );
  if (Number(result?.affectedRows) !== 1) {
    throw new Error("The media reservation could not be attached to the provider job.");
  }
};

const findOwnedJob = async (userId: string, provider: unknown, providerJobId: unknown): Promise<MediaJobRow | null> => {
  const rows = await execQuery("SELECT * FROM media_generation_jobs WHERE job_key = ? LIMIT 1", [jobKey(provider, providerJobId)]);
  const job = Array.isArray(rows) ? rows[0] as MediaJobRow | undefined : undefined;
  if (!job || String(job.user_id) !== userId) return null;
  return job;
};

const finalizeJobCharge = async (job: MediaJobRow): Promise<{ charged: boolean; balance: number; insufficient: boolean }> =>
  withTransaction(async (query) => {
    const rows = await query("SELECT * FROM media_generation_jobs WHERE job_key = ? FOR UPDATE", [job.job_key]);
    const locked = Array.isArray(rows) ? rows[0] as MediaJobRow | undefined : undefined;
    if (!locked) throw new Error("Media job disappeared before billing completed.");

    if (locked.charged_at) {
      const balances = await query("SELECT COALESCE(pixels, 0) AS pixels FROM members WHERE id = ?", [locked.user_id]);
      return { charged: false, balance: Number(balances?.[0]?.pixels) || 0, insufficient: false };
    }

    const debit = await query(
      "UPDATE members SET pixels = COALESCE(pixels, 0) - ? WHERE id = ? AND COALESCE(pixels, 0) >= ?",
      [locked.pixels, locked.user_id, locked.pixels],
    );
    if (Number(debit?.affectedRows) !== 1) {
      const balances = await query("SELECT COALESCE(pixels, 0) AS pixels FROM members WHERE id = ?", [locked.user_id]);
      await query("UPDATE media_generation_jobs SET status = 'completed_unpaid' WHERE job_key = ?", [locked.job_key]);
      return { charged: false, balance: Number(balances?.[0]?.pixels) || 0, insufficient: true };
    }

    await query(
      "UPDATE media_generation_jobs SET status = 'succeeded', charged_at = CURRENT_TIMESTAMP WHERE job_key = ?",
      [locked.job_key],
    );
    const balances = await query("SELECT COALESCE(pixels, 0) AS pixels FROM members WHERE id = ?", [locked.user_id]);
    return { charged: true, balance: Number(balances?.[0]?.pixels) || 0, insufficient: false };
  });

const updateJobStatus = async (jobKeyValue: string, status: string): Promise<void> => {
  await execQuery("UPDATE media_generation_jobs SET status = ? WHERE job_key = ?", [safeText(status, 32), jobKeyValue]);
};

export const withMediaBilling = (handler: MediaHandler): RequestHandler =>
  async (req, res, next): Promise<any> => {
    const userId = authenticatedOwnerId(req);
    if (!userId) return res.status(401).json({ message: "Please sign in to generate media." });
    let profileTarget: ProfileImageTarget | undefined;
    let profileSourceUrl: string | undefined;
    if (req.body?.profileImage != null) {
      try {
        if (req.body.templateCover === true || !templateCoverQualityForRoute(req.path)) throw new Error('Choose a supported profile image model.');
        profileTarget = profileImageTarget(req.body.profileImage, authenticatedUserId(req));
        if (req.body.profileImage.source != null) {
          const source = req.body.profileImage.source;
          if (typeof source.imageUrl !== 'string' || !source.imageUrl || source.imageUrl.length > 4096)
            throw new Error('Choose a verified profile image to edit.');
          verifyProfileImageReceipt(source.receipt, userId, profileTarget, source.imageUrl);
          profileSourceUrl = source.imageUrl;
        }
      } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid profile image request.' });
      }
    }

    try {
      await attachMeasuredSourceDuration(req.path || req.originalUrl, req.body);
    } catch (error: any) {
      return res.status(422).json({
        message: error?.message || "The source media duration could not be verified.",
      });
    }

    let charge: ReturnType<typeof mediaChargeFor>;
    try { charge = mediaChargeFor(req.path || req.originalUrl, req.body); }
    catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid media generation settings.' });
    }
    if (!charge) {
      return res.status(503).json({
        message: "This generation route is unavailable because its server-side price has not been configured.",
      });
    }
    const recoveryToken = ['/spatial-video', '/upscaleVideo'].includes(req.path) && /^[a-f0-9-]{36}$/.test(String(req.body?.job?.submissionToken || '')) ? req.body.job.submissionToken : null;
    const label = profileTarget ? ACTION_LABELS[`profile-${profileTarget.kind}`]
      : recoveryToken ? `${actionLabelFor(req.body, charge.defaultLabel)} · spatial:${recoveryToken}` : actionLabelFor(req.body, charge.defaultLabel);
    setUsageAction(charge.kind === "video" ? "video_generation" : "image_generation", label);

    const startingBalance = Number(await getPixelsForUser(userId)) || 0;
    if (startingBalance < charge.pixels) return insufficient(res, userId, charge.pixels, label);
    const reservation = await reserveMediaRequest(userId, req.path, charge.pixels, label);
    if (!reservation) return insufficient(res, userId, charge.pixels, label);

    const capture = installCapture(res);
    let releaseProfileSource: (() => Promise<void>) | undefined;
    try {
      if (profileSourceUrl && profileTarget) {
        const { prepareProfileImageReference } = await import('./profileImageReference');
        const source = await prepareProfileImageReference(profileTarget, profileSourceUrl);
        releaseProfileSource = source.release;
        req.body.sampleImages = [source.imageUrl];
        req.body.sampleImage = source.imageUrl;
        req.body.imageInputs = [source.imageUrl];
        delete req.body.sampleimagesnames;
      }
      await handler(req, res, next);
      const captured = capture.read();
      capture.restore();
      if (!captured || res.headersSent) {
        await updateJobStatus(reservation.job_key, "failed");
        return;
      }

      const body = captured.body;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        await updateJobStatus(reservation.job_key, "failed");
        return capture.release(captured);
      }

      if (charge.kind === "video" && body?.status === "starting" && body?.jobId && body?.provider) {
        await activateAsyncJob(reservation, body);
        return capture.release({ kind: "json", body: { ...body, billingPending: true, requiredPixels: charge.pixels } });
      }

      if (!isSuccessfulMedia(body, charge.kind)) {
        await updateJobStatus(reservation.job_key, "failed");
        res.status(502);
        return capture.release({ kind: "json", body: { error: "The provider returned no usable media. No pixels were charged." } });
      }

      const coverQuality = templateCoverQualityForRoute(req.path);
      const templateCover = req.body?.templateCover === true && coverQuality !== undefined;
      let storedCover: string | undefined;
      let coverReceipt: (() => string) | undefined;
      let discardStoredCover: () => Promise<unknown> = async () => {};
      if (templateCover || profileTarget) {
        const { storeNormalizedImage, deleteCloudImageUrl } = await import('./S3Routes');
        const { queueTemplateAssetCleanup } = await import('./templateAssetCleanup');
        const { signTemplateCoverReceipt } = await import('./templateCoverReceipt');
        const output = body.imageUrl || body.imageBase64 || body.image;
        const source = /^https?:|^data:image\//.test(String(output)) ? String(output) : `data:image/png;base64,${output}`;
        storedCover = (await storeNormalizedImage(source, profileTarget
          ? `profile-image-${profileTarget.memberId}-${profileTarget.kind}` : 'template-cover', Boolean(profileTarget),
          profileTarget ? async (url, upload) => {
            await queueTemplateAssetCleanup(url, undefined, 2 * 60 * 60);
            await upload();
          } : undefined)).imageUrl;
        const url = storedCover;
        discardStoredCover = () => deleteCloudImageUrl(url);
        coverReceipt = profileTarget
          ? () => signProfileImageReceipt({ ...profileTarget!, ownerId: userId, imageUrl: url, quality: coverQuality! })
          : () => signTemplateCoverReceipt({ userId, imageUrl: url,
            quality: coverQuality!, target: String(req.body.templateCoverTarget || '') });
        // Unused generated covers are reclaimed even if the browser disconnects.
        try { if (!profileTarget) await queueTemplateAssetCleanup(storedCover, undefined, 2 * 60 * 60); }
        catch (error) { await discardStoredCover().catch(() => {}); throw error; }
      }
      let result: Awaited<ReturnType<typeof finalizeJobCharge>>;
      try { result = await finalizeJobCharge(reservation); }
      catch (error) { if (storedCover) await discardStoredCover().catch(() => {}); throw error; }
      if (result.insufficient) {
        if (storedCover) await discardStoredCover().catch(() => {});
        return insufficient(res, userId, charge.pixels, label);
      }
      const balance = result.balance;
      recordPixelCharge(charge.pixels, "server-media-billing");
      setBillingHeaders(res, charge.pixels, balance, label);
      if (storedCover) return capture.release({ kind: 'json', body: {
        ...body, imageUrl: storedCover, ...(profileTarget ? { profileImageReceipt: coverReceipt!() } : { coverReceipt: coverReceipt!() }),
      } });
      return capture.release(captured);
    } catch (error) {
      capture.restore();
      try { await updateJobStatus(reservation.job_key, "failed"); } catch { /* preserve original provider error */ }
      next(error);
    } finally {
      // The durable 2h work item remains if this immediate cleanup enqueue fails.
      if (releaseProfileSource) await releaseProfileSource().catch(() => {});
    }
  };

export const withMediaPollBilling = (handler: MediaHandler): RequestHandler =>
  async (req, res, next): Promise<any> => {
    const userId = authenticatedOwnerId(req);
    if (!userId) return res.status(401).json({ message: "Please sign in to check this video." });

    const requestedProvider = safeText(req.body?.provider, 64).toLowerCase();
    const requestedJobId = safeText(req.body?.jobId, 255);
    const job = await findOwnedJob(userId, requestedProvider, requestedJobId);
    if (!job) return res.status(404).json({ message: "This video job does not exist or belongs to another user." });

    req.body.provider = job.provider;
    req.body.jobId = job.provider_job_id;
    req.body.modelEndpoint = job.model_endpoint || undefined;
    setUsageAction("video_generation", job.action_label);

    const capture = installCapture(res);
    try {
      await handler(req, res, next);
      const captured = capture.read();
      capture.restore();
      if (!captured || res.headersSent) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return capture.release(captured);

      const status = safeText(captured.body?.status, 32).toLowerCase();
      if (status === "succeeded" && isSuccessfulMedia(captured.body, "video")) {
        const result = await finalizeJobCharge(job);
        if (result.insufficient) {
          return res.status(402).json({
            message: `The video succeeded, but ${job.action_label} needs ${job.pixels} P and the current balance is ${result.balance} P. The media is being withheld until it can be billed.`,
            pixels: result.balance,
            required: job.pixels,
          });
        }
        if (result.charged) recordPixelCharge(job.pixels, "server-media-billing");
        setBillingHeaders(res, result.charged ? job.pixels : 0, result.balance, job.action_label);
      } else if (status === "failed" || status === "canceled") {
        await updateJobStatus(job.job_key, status);
      } else {
        await updateJobStatus(job.job_key, "processing");
      }

      return capture.release(captured);
    } catch (error) {
      capture.restore();
      next(error);
    }
  };
