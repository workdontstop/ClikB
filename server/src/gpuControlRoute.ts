import type { Request, Response } from "express";
import crypto from "crypto";
import fetch from "node-fetch";

import { authenticatedOwnerId } from "./requestAuth";
import { generateUploadURLVideo, generateH3VideoReadURL } from "./S3Routes";
import execQuery from "./execQuery";


type ModalGpuStatus = "off" | "starting" | "ready" | "stopping" | "error";
type ModalGpuEngine = "h3" | "ltx";

type ModalGpuState = {
  status: ModalGpuStatus;
  gpu_label?: string;
  message?: string;
  uptime_seconds?: number;
  startup_seconds?: number;
  stage?: string;
  stage_index?: number;
  stage_total?: number;
  gpu_count?: number;
  active_containers?: number;
  started_at?: number | null;
  ready_at?: number | null;
  stopped_at?: number | null;
  shutdown_requested_at?: number | null;
  paid_deadline_at?: number | null;
  paid_remaining_seconds?: number | null;
  billing_active?: boolean;
  billing_started_at?: number | null;
  paid_balance_pending?: boolean;
  session_id?: string | null;
  gpu_time_seconds?: number;
  pixels?: number;
  error?: string | null;
};

type ModalGenerationState = {
  status: "queued" | "starting" | "running" | "succeeded" | "failed" | "cancelled";
  jobId?: string;
  videoUrl?: string;
  downloadUrl?: string;
  error?: string;
  message?: string;
  phase?: string;
  progress?: number;
  queue_position?: number;
  active_jobs?: number;
  paid_remaining_seconds?: number | null;
  session_id?: string | null;
};

const modalGpuStartRequests = new Map<string, Promise<ModalGpuState>>();
const modalGpuSettlementRequests = new Map<string, Promise<number | null>>();
const lastSettledModalSession = new Map<string, string>();
const GPU_TIME_PLANS = new Map<number, { pixels: number; seconds: number }>([
  [30, { pixels: 1200, seconds: 30 * 60 }],
  [60, { pixels: 2400, seconds: 60 * 60 }],
  [120, { pixels: 4800, seconds: 120 * 60 }],
]);

type GpuAccount = {
  pixels: number;
  gpuTimeSeconds: number;
};

async function readGpuAccount(userId: string): Promise<GpuAccount> {
  const rows = await execQuery(
    "SELECT COALESCE(pixels, 0) AS pixels, COALESCE(gputime, 0) AS gputime FROM members WHERE id = ? LIMIT 1",
    [userId]
  ) as Array<{ pixels?: number; gputime?: number }>;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) throw new Error("GPU account was not found.");
  return {
    pixels: Math.max(0, Number(row.pixels || 0)),
    gpuTimeSeconds: Math.max(0, Math.floor(Number(row.gputime || 0))),
  };
}

async function writeGpuTime(userId: string, seconds: number): Promise<void> {
  await execQuery(
    "UPDATE members SET gputime = ? WHERE id = ?",
    [Math.max(0, Math.floor(seconds)), userId]
  );
}

function modalPaidSeconds(value: { paid_remaining_seconds?: number | null }): number | null {
  const rawSeconds = value.paid_remaining_seconds;
  if (rawSeconds === null || rawSeconds === undefined) return null;
  const seconds = Number(rawSeconds);
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : null;
}

function requireAuthenticatedUser(req: Request, res: Response): string | null {
  const ownerId = authenticatedOwnerId(req);
  if (ownerId) return ownerId;
  if (process.env.APP_STATE === "dev") return "1";
  res.status(401).json({ error: "Please sign in to control the GPU." });
  return null;
}

function requestedGpuEngine(req: Request): ModalGpuEngine {
  const raw = String(req.body?.engine ?? req.query?.engine ?? "h3").trim().toLowerCase();
  if (raw !== "h3" && raw !== "ltx") {
    throw new Error("GPU engine must be h3 or ltx.");
  }
  return raw;
}

function modalControlConfig(userKey: string): {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
} {
  const engine: ModalGpuEngine = userKey.startsWith("ltx-") ? "ltx" : "h3";
  const urlVariable = engine === "ltx"
    ? "MODAL_LTX25_B300_CONTROL_URL"
    : "MODAL_H3_B300_CONTROL_URL";
  const baseUrl = String(process.env[urlVariable] || "").replace(/\/$/, "");
  const tokenId = String(process.env.MODAL_PROXY_TOKEN_ID || "");
  const tokenSecret = String(process.env.MODAL_PROXY_TOKEN_SECRET || "");

  if (!baseUrl || !tokenId || !tokenSecret) {
    throw new Error(
      "Modal GPU control is not configured on the ClikB backend."
    );
  }
  if (!baseUrl.startsWith("https://")) {
    throw new Error(`${urlVariable} must use HTTPS.`);
  }

  return { baseUrl, tokenId, tokenSecret };
}

function modalUserKey(userId: string, engine: ModalGpuEngine = "h3"): string {
  const secret = String(process.env.MODAL_USER_KEY_SECRET || process.env.SECRET_KEYY || "");
  if (!secret) throw new Error("Modal user session hashing is not configured.");
  const key = crypto.createHmac("sha256", secret).update(userId).digest("hex");
  // Preserve the exact production H3 identity. Only the isolated LTX app gets
  // a namespace, which also prevents local request-deduplication collisions.
  return engine === "ltx" ? `ltx-${key}` : key;
}

async function callModalControl<T extends { status: string }>(
  path: "/start" | "/status" | "/stop" | "/generate" | "/generation-status" | "/extend-time" | "/ack-time",
  method: "GET" | "POST",
  userKey: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const { baseUrl, tokenId, tokenSecret } = modalControlConfig(userKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const query = new URLSearchParams({ user_key: userKey });
  if (typeof payload.job_id === "string") query.set("job_id", payload.job_id);
  const url = method === "GET" ? `${baseUrl}${path}?${query.toString()}` : `${baseUrl}${path}`;
  const sessionTag = userKey.slice(0, 12);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Modal-Key": tokenId,
        "Modal-Secret": tokenSecret,
      },
      body: method === "POST" ? JSON.stringify({ user_key: userKey, ...payload }) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: Record<string, unknown> = {};
    if (raw) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        body = { error: raw.slice(0, 500) };
      }
    }

    if (!response.ok) {
      const detail = String(body.detail || body.error || "");
      console.error(`[ModalGPU][http] ${method} ${path} session=${sessionTag} http=${response.status} detail=${detail.slice(0, 300) || "none"}`);
      throw new Error(detail || `Modal returned HTTP ${response.status}.`);
    }
    if (!("status" in body)) {
      throw new Error("Modal returned an invalid GPU status response.");
    }
    return body as T;
  } catch (error: any) {
    console.error(`[ModalGPU][http] ${method} ${path} session=${sessionTag} failed=${String(error?.message || error).slice(0, 300)}`);
    if (error?.name === "AbortError") {
      throw new Error("Modal GPU control timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Modal owns the countdown while a session is active. Once that session is no
 * longer active, persist its final balance exactly once and acknowledge the
 * hand-off so later off-status checks cannot overwrite newly purchased time.
 */
async function settleModalPaidBalance(
  userId: string,
  sessionKey: string,
  state: ModalGpuState
): Promise<number | null> {
  // Allocated loading AND GPU release remain billable. Only a confirmed final
  // state can hand the remaining balance back to the member account.
  if (state.status !== "off" && state.status !== "error") return null;
  const paidSeconds = modalPaidSeconds(state);
  if (paidSeconds === null) return null;
  // Acknowledged sessions no longer own a balance. This prevents an old
  // terminal generation response from settling the same session a second time.
  if (state.paid_balance_pending === false) return null;

  const modalSessionId = String(state.session_id || "legacy");
  const settlementKey = `${sessionKey}:${modalSessionId}`;
  if (lastSettledModalSession.get(sessionKey) === modalSessionId) return paidSeconds;

  let settlement = modalGpuSettlementRequests.get(settlementKey);
  if (!settlement) {
    settlement = (async () => {
      await writeGpuTime(userId, paidSeconds);
      await callModalControl<ModalGpuState>("/ack-time", "POST", sessionKey, {
        session_id: modalSessionId,
      });
      lastSettledModalSession.set(sessionKey, modalSessionId);
      return paidSeconds;
    })();
    modalGpuSettlementRequests.set(settlementKey, settlement);
    void settlement.finally(() => {
      if (modalGpuSettlementRequests.get(settlementKey) === settlement) {
        modalGpuSettlementRequests.delete(settlementKey);
      }
    }).catch(() => undefined);
  }
  return settlement;
}

function sendControlError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "GPU control failed.";
  const isConfigurationError = message.includes("not configured") || message.includes("must use HTTPS");
  res.status(isConfigurationError ? 503 : 502).json({ error: message });
}

export async function startModalGpu(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;

  try {
    const engine = requestedGpuEngine(req);
    const sessionKey = modalUserKey(userId, engine);
    const sessionTag = sessionKey.slice(0, 12);
    const otherEngine: ModalGpuEngine = engine === "h3" ? "ltx" : "h3";
    try {
      const otherState = await callModalControl<ModalGpuState>(
        "/status",
        "GET",
        modalUserKey(userId, otherEngine)
      );
      if (otherState.status === "starting" || otherState.status === "ready" || otherState.status === "stopping") {
        res.status(409).json({
          status: otherState.status,
          error: `Stop the active ${otherEngine.toUpperCase()} GPU before starting ${engine.toUpperCase()}.`,
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // A missing/unconfigured optional engine cannot block the selected one.
      if (!message.includes("HTTP 404") && !message.includes("not configured")) throw error;
    }
    console.info(`[ModalGPU][start] session=${sessionTag} stage=status-precheck`);
    let existingState: ModalGpuState | null = null;
    try {
      existingState = await callModalControl<ModalGpuState>("/status", "GET", sessionKey);
      console.info(`[ModalGPU][start] session=${sessionTag} stage=status-ok status=${existingState.status}`);
      await settleModalPaidBalance(userId, sessionKey, existingState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("HTTP 404")) throw error;
    }
    if (existingState?.status === "stopping") {
      const account = await readGpuAccount(userId);
      res.status(409).json({
        status: "stopping",
        error: "Wait for GPU shutdown to finish before starting it again.",
        pixels: account.pixels,
        gpu_time_seconds: account.gpuTimeSeconds,
      });
      return;
    }
    const account = await readGpuAccount(userId);
    console.info(`[ModalGPU][start] session=${sessionTag} stage=account-ok gpu_seconds=${account.gpuTimeSeconds}`);
    // Starting is authorized by the authenticated member record. Modal's live
    // countdown is returned after start/status, but it must not override a
    // positive persisted balance while deciding whether Start may be sent.
    const availableSeconds = account.gpuTimeSeconds;
    if (availableSeconds <= 0) {
      res.status(402).json({
        status: "off",
        error: "Add GPU time before starting the GPU.",
        requires_gpu_time: true,
        pixels: account.pixels,
        gpu_time_seconds: account.gpuTimeSeconds,
      });
      return;
    }
    console.info(`[ModalGPU][start] session=${sessionTag} stage=modal-start-submit`);
    let startRequest = modalGpuStartRequests.get(sessionKey);
    if (!startRequest) {
      startRequest = callModalControl<ModalGpuState>("/start", "POST", sessionKey, {
        paid_seconds: availableSeconds,
      });
      modalGpuStartRequests.set(sessionKey, startRequest);
      void startRequest.finally(() => {
        if (modalGpuStartRequests.get(sessionKey) === startRequest) {
          modalGpuStartRequests.delete(sessionKey);
        }
      }).catch(() => undefined);
    } else {
      console.info(`[ModalGPU][start] session=${sessionKey.slice(0, 12)} request=deduplicated`);
    }
    const state = await startRequest;
    console.info(`[ModalGPU][start] session=${sessionKey.slice(0, 12)} status=${state.status} containers=${state.active_containers ?? "unknown"}`);
    res.status(202).json({
      ...state,
      pixels: account.pixels,
      gpu_time_seconds: modalPaidSeconds(state) ?? availableSeconds,
    });
  } catch (error) {
    console.error(`[ModalGPU][start] stage=failed error=${String(error instanceof Error ? error.message : error).slice(0, 500)}`);
    sendControlError(res, error);
  }
}

export async function getModalGpuStatus(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;

  try {
    const engine = requestedGpuEngine(req);
    const sessionKey = modalUserKey(userId, engine);
    const state = await callModalControl<ModalGpuState>("/status", "GET", sessionKey);
    const paidSeconds = modalPaidSeconds(state);
    if (state.status === "off" || state.status === "error") {
      try {
        await settleModalPaidBalance(userId, sessionKey, state);
      } catch (settlementError) {
        // Modal's terminal state is authoritative even if the independent
        // balance acknowledgement is interrupted. Returning 502 here left the
        // client showing Releasing (and locally counting) after the GPU was
        // already gone. The next status/start precheck safely retries because
        // writeGpuTime is an absolute, idempotent update.
        console.error(
          `[ModalGPU][settlement] session=${sessionKey.slice(0, 12)} status=${state.status} retry=pending error=${String(
            settlementError instanceof Error ? settlementError.message : settlementError
          ).slice(0, 300)}`
        );
      }
      const account = await readGpuAccount(userId);
      res.status(200).json({
        ...state,
        pixels: account.pixels,
        gpu_time_seconds: account.gpuTimeSeconds,
      });
      return;
    }
    res.status(200).json({
      ...state,
      ...(paidSeconds !== null ? { gpu_time_seconds: paidSeconds } : {}),
    });
  } catch (error) {
    // Stopping a Modal app removes its web endpoint. That 404 is an
    // authoritative off signal, not a transient polling failure. Returning a
    // normal off state lets an already-open editor recover without a reload.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("HTTP 404")) {
      const account = await readGpuAccount(userId);
      res.status(200).json({
        status: "off",
        message: "GPU is off",
        gpu_count: 0,
        active_containers: 0,
        uptime_seconds: 0,
        stage: "off",
        stage_index: 0,
        stage_total: 4,
        error: null,
        pixels: account.pixels,
        gpu_time_seconds: account.gpuTimeSeconds,
      } satisfies ModalGpuState);
      return;
    }
    sendControlError(res, error);
  }
}

export async function stopModalGpu(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;

  try {
    const engine = requestedGpuEngine(req);
    const sessionKey = modalUserKey(userId, engine);
    console.info(`[ModalGPU][stop] session=${sessionKey.slice(0, 12)} request=received`);
    const state = await callModalControl<ModalGpuState>("/stop", "POST", sessionKey);
    try {
      await settleModalPaidBalance(userId, sessionKey, state);
    } catch (settlementError) {
      // Do not turn a confirmed GPU shutdown into a failed Stop response just
      // because the separate time-balance acknowledgement needs a retry.
      console.error(
        `[ModalGPU][settlement] session=${sessionKey.slice(0, 12)} status=${state.status} retry=pending error=${String(
          settlementError instanceof Error ? settlementError.message : settlementError
        ).slice(0, 300)}`
      );
    }
    const account = await readGpuAccount(userId);
    console.info(`[ModalGPU][stop] session=${sessionKey.slice(0, 12)} status=${state.status} containers=${state.active_containers ?? "unknown"}`);
    res.status(200).json({
      ...state,
      pixels: account.pixels,
      gpu_time_seconds: modalPaidSeconds(state) ?? account.gpuTimeSeconds,
    });
  } catch (error) {
    sendControlError(res, error);
  }
}

export async function generateModalGpuVideo(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;

  try {
    const engine = requestedGpuEngine(req);
    const signedUploadUrl = await generateUploadURLVideo("modal-h3-video");
    const outputKey = decodeURIComponent(new URL(signedUploadUrl).pathname.slice(1));
    const verifyUrl = await generateH3VideoReadURL(outputKey);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const state = await callModalControl<ModalGenerationState>(
      "/generate",
      "POST",
      modalUserKey(userId, engine),
      {
        ...payload,
        upload_url: signedUploadUrl,
        video_url: signedUploadUrl.split("?")[0],
        verify_url: verifyUrl,
      }
    );
    res.status(202).json(state);
  } catch (error) {
    sendControlError(res, error);
  }
}

export async function getModalGpuGenerationStatus(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;
  const jobId = String(req.query.jobId || "").trim();
  if (!jobId) {
    res.status(400).json({ error: "A GPU generation job ID is required." });
    return;
  }

  try {
    const engine = requestedGpuEngine(req);
    const state = await callModalControl<ModalGenerationState>(
        "/generation-status",
        "GET",
        modalUserKey(userId, engine),
        { job_id: jobId }
      );
    if (state.status === "succeeded" && state.videoUrl) {
      const outputKey = decodeURIComponent(new URL(state.videoUrl).pathname.slice(1));
      state.downloadUrl = await generateH3VideoReadURL(outputKey);
    }
    // Generation polling is not a billing authority. In particular, a result
    // from a cancelled/older Modal session must never overwrite the balance
    // already frozen by /stop. /status and /stop perform settlement exactly once.
    res.status(200).json(state);
  } catch (error) {
    sendControlError(res, error);
  }
}

export async function getModalGpuTime(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;
  try {
    const account = await readGpuAccount(userId);
    res.status(200).json({
      status: "ok",
      pixels: account.pixels,
      gpu_time_seconds: account.gpuTimeSeconds,
    });
  } catch (error) {
    sendControlError(res, error);
  }
}

export async function convertModalGpuTime(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;
  const minutes = Number(req.body?.minutes);
  const plan = GPU_TIME_PLANS.get(minutes);
  if (!plan) {
    res.status(400).json({ error: "Choose 30, 60, or 120 GPU minutes." });
    return;
  }

  let modalState: ModalGpuState | null = null;
  try {
    const engine = requestedGpuEngine(req);
    const sessionKey = modalUserKey(userId, engine);
    try {
      modalState = await callModalControl<ModalGpuState>(
        "/status",
        "GET",
        sessionKey
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("HTTP 404")) throw error;
    }

    if (modalState?.status === "stopping") {
      res.status(409).json({ error: "Wait for GPU shutdown to finish before adding time." });
      return;
    }
    if (modalState && modalState.status !== "starting" && modalState.status !== "ready") {
      await settleModalPaidBalance(userId, sessionKey, modalState);
    }

    const update = await execQuery(
      `UPDATE members
       SET pixels = pixels - ?, gputime = COALESCE(gputime, 0) + ?
       WHERE id = ? AND COALESCE(pixels, 0) >= ?`,
      [plan.pixels, plan.seconds, userId, plan.pixels]
    ) as { affectedRows?: number };
    if (!update?.affectedRows) {
      const account = await readGpuAccount(userId);
      res.status(409).json({
        error: "Not enough Pixels to add this GPU time.",
        pixels: account.pixels,
        gpu_time_seconds: account.gpuTimeSeconds,
      });
      return;
    }

    try {
      if (modalState && (modalState.status === "starting" || modalState.status === "ready")) {
        const extended = await callModalControl<ModalGpuState>(
          "/extend-time",
          "POST",
          sessionKey,
          { added_seconds: plan.seconds }
        );
        const liveSeconds = modalPaidSeconds(extended);
        if (liveSeconds !== null) await writeGpuTime(userId, liveSeconds);
        modalState = extended;
      }
    } catch (error) {
      await execQuery(
        `UPDATE members
         SET pixels = COALESCE(pixels, 0) + ?,
             gputime = GREATEST(COALESCE(gputime, 0) - ?, 0)
         WHERE id = ?`,
        [plan.pixels, plan.seconds, userId]
      );
      throw error;
    }

    const account = await readGpuAccount(userId);
    res.status(200).json({
      status: "converted",
      minutes,
      pixels_spent: plan.pixels,
      pixels: account.pixels,
      gpu_time_seconds: modalPaidSeconds(modalState || {}) ?? account.gpuTimeSeconds,
      modal_status: modalState?.status || "off",
    });
  } catch (error) {
    sendControlError(res, error);
  }
}
