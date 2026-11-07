import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  accumulateMeteredUsage, configureMeteredUsageFailureHandler, configureMeteredSettlementFailureHandler, settleMeteredSession,
  type MeteredUsageIncrement, type MeteredSettlementParams,
} from "./meteredUsageBilling";

// Contains billing metadata only. Never serialize a request, prompt, audio,
// query runner, authentication cookie or provider response into this outbox.
export const serializableUsageIncrement = (input: MeteredUsageIncrement): MeteredUsageIncrement => {
  const event: MeteredUsageIncrement = {
    eventId: String(input.eventId || ""), userId: String(input.userId || ""),
    sessionKey: String(input.sessionKey || ""),
    workload: input.workload || input.surface || "concierge",
    profile: input.profile || input.tier || "luna", model: input.model,
    billableToUser: input.billableToUser !== false,
  };
  if (!event.eventId || !event.userId || !event.sessionKey) throw new Error("Usage outbox requires an immutable authenticated event identity.");
  for (const field of ["costSubunits", "rawPixels", "providerCostUsd"] as const) {
    const value = input[field];
    if (value !== undefined) {
      if (!Number.isFinite(value) || value < 0) throw new Error("Invalid usage cost in outbox event.");
      event[field] = value;
    }
  }
  return event;
};

type OutboxRecord = { kind: "usage"; increment: MeteredUsageIncrement } | { kind: "settlement"; params: MeteredSettlementParams };
const cleanSettlement = (input: MeteredSettlementParams): MeteredSettlementParams => {
  if (!input.userId || !input.sessionKey) throw new Error("Settlement outbox requires authenticated accounting identity.");
  return { userId: String(input.userId), sessionKey: String(input.sessionKey),
    workload: input.workload || input.surface || "concierge", profile: input.profile || input.tier || "luna", model: input.model,
    ...(input.stage ? { stage: String(input.stage) } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: String(input.idempotencyKey) } : {}),
    ...(input.forceReceipt ? { forceReceipt: true } : {}), ...(input.strictFullBalance ? { strictFullBalance: true } : {}) };
};
const eventFile = (record: OutboxRecord) => createHash("sha256").update(JSON.stringify(record.kind === "usage"
  ? [record.increment.userId, record.increment.sessionKey, record.increment.eventId]
  : ["settlement", record.params])).digest("hex") + ".json";
const normalizeRecord = (raw: any): OutboxRecord => raw?.kind === "settlement"
  ? { kind: "settlement", params: cleanSettlement(raw.params) }
  : { kind: "usage", increment: serializableUsageIncrement(raw?.kind === "usage" ? raw.increment : raw) };

export function createMeteredUsageOutbox(options: {
  directory: string;
  accumulate?: typeof accumulateMeteredUsage;
  settle?: typeof settleMeteredSession;
  batchSize?: number;
}) {
  const directory = path.resolve(options.directory);
  const accept = options.accumulate || accumulateMeteredUsage;
  const settle = options.settle || settleMeteredSession;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let retryCursor = "";
  const publish = async (record: OutboxRecord, error?: unknown): Promise<void> => {
    const status = Number((error as { status?: number })?.status);
    if (status >= 400 && status < 500) return; // Never queue rejected ownership/auth/conflicting usage.
    const body = JSON.stringify(record);
    await fs.mkdir(directory, { recursive: true });
    const destination = path.join(directory, eventFile(record));
    const lock = destination + ".lock", owner = path.join(lock, "owner.json");
    const temporary = path.join(directory, `.${randomUUID()}.tmp`);
    let acquired = false;
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(body); await handle.sync(); } finally { await handle.close(); }
      // mkdir is a portable atomic lock on Windows too. Hard links can be
      // denied by managed filesystems; never publish partially written JSON.
      for (let attempt = 0; attempt < 100 && !acquired; attempt++) {
        try { await fs.mkdir(lock); acquired = true; await fs.writeFile(owner, JSON.stringify({ pid: process.pid })); }
        catch (e: any) {
          if (e?.code !== "EEXIST") throw e;
          try {
            const stat = await fs.stat(lock);
            if (Date.now() - stat.mtimeMs > 30_000) {
              let alive = false;
              try { const value = JSON.parse(await fs.readFile(owner, "utf8")); process.kill(Number(value.pid), 0); alive = true; }
              catch (error: any) { if (error?.code !== "ESRCH" && error?.code !== "ENOENT" && !(error instanceof SyntaxError)) alive = true; }
              if (!alive) { await fs.unlink(owner).catch(() => {}); await fs.rmdir(lock).catch(() => {}); }
            }
          } catch { /* A publisher may have just released its lock. */ }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      if (!acquired) throw new Error("Usage outbox publisher is busy; event was not accepted.");
      try {
        if (await fs.readFile(destination, "utf8") !== body) throw new Error("Conflicting immutable usage outbox event.");
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
        await fs.rename(temporary, destination);
        // Sync directory metadata where supported; Windows can deny directory handles.
        try { const dir = await fs.open(directory, "r"); try { await dir.sync(); } finally { await dir.close(); } } catch { /* File itself was synced before rename. */ }
      }
    } finally {
      await fs.unlink(temporary).catch(() => {});
      if (acquired) { await fs.unlink(owner).catch(() => {}); await fs.rmdir(lock).catch(() => {}); }
    }
  };
  const save = (input: MeteredUsageIncrement, error?: unknown) => publish({ kind: "usage", increment: serializableUsageIncrement(input) }, error);
  const saveSettlement = (input: MeteredSettlementParams, error?: unknown) => publish({ kind: "settlement", params: cleanSettlement(input) }, error);
  const drain = (): Promise<void> => {
    if (running) return running;
    running = (async () => {
      await fs.mkdir(directory, { recursive: true });
      const names = (await fs.readdir(directory)).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).sort();
      const files = [...names.filter(name => name > retryCursor), ...names.filter(name => name <= retryCursor)]
        .slice(0, Math.max(1, Math.min(100, options.batchSize || 25)));
      if (files.length) retryCursor = files[files.length - 1];
      for (const name of files) {
        const filename = path.join(directory, name);
        let record: OutboxRecord;
        try {
          record = normalizeRecord(JSON.parse(await fs.readFile(filename, "utf8")));
          if (eventFile(record) !== name) throw new Error("Usage outbox identity mismatch.");
        } catch (error: any) {
          if (error?.code === "ENOENT") continue; // Another worker accepted this event.
          await fs.rename(filename, `${filename}.invalid`).catch(() => {});
          console.error("[metered-outbox] invalid metadata quarantined:", name);
          continue;
        }
        try {
          let params: MeteredSettlementParams;
          if (record.kind === "usage") {
          const event = record.increment;
          await accept(event); // SQL event ID deduplication makes restart/concurrent replay safe.
          params = {
            sessionKey: event.sessionKey, userId: event.userId,
            workload: event.workload, profile: event.profile, model: event.model,
          };
          } else params = record.params;
          const receipt = await settle(params);
          if (receipt?.pendingReconciliation) continue;
          await fs.unlink(filename).catch((error: any) => { if (error?.code !== "ENOENT") throw error; });
        } catch (error: any) {
          const status = Number(error?.status);
          if (status >= 400 && status < 500 && ![402, 408, 425, 429].includes(status)) {
            await fs.rename(filename, `${filename}.rejected`).catch(() => {});
            console.error("[metered-outbox] terminal accounting rejection quarantined:", name);
          }
          // Transient failures keep the immutable file for a later rotating batch.
        }
      }
    })().finally(() => { running = null; });
    return running;
  };
  const start = (intervalMs = 10_000) => {
    if (timer) return;
    void drain().catch(error => console.error("[metered-outbox] startup retry failed:", error?.message));
    timer = setInterval(() => { void drain().catch(error => console.error("[metered-outbox] retry failed:", error?.message)); }, Math.max(100, intervalMs));
    timer.unref?.();
  };
  return { save, saveSettlement, drain, start, stop: () => { if (timer) clearInterval(timer); timer = null; } };
}

export function startMeteredUsageOutbox() {
  const serverRoot = path.basename(__dirname) === "backend" && path.basename(path.dirname(__dirname)) === "dist"
    ? path.resolve(__dirname, "../..") : path.resolve(__dirname, "..");
  const outbox = createMeteredUsageOutbox({ directory: process.env.METERED_USAGE_OUTBOX_DIR
    || path.join(serverRoot, "logs/metered-usage-outbox") });
  configureMeteredUsageFailureHandler(outbox.save);
  configureMeteredSettlementFailureHandler(outbox.saveSettlement);
  outbox.start();
  return outbox;
}
