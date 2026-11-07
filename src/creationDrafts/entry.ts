import { useSyncExternalStore } from 'react';
import { stableDraftJson, validateDraftSnapshot, type DraftRecord } from '../../server/src/creationDrafts/schema';
import { createDraftApi, DraftApiError, type DraftApi } from './api';
import { createDraftController, type DraftController, type DraftStorage } from './store';
import { readDraftBackup } from './localBackup';

export interface PendingDraftEntry {
  requestId: string;
  mode: 'resume' | 'remix';
  record: DraftRecord;
  controller: DraftController;
}
const entries = new Map<string, PendingDraftEntry>();
const subscribers = new Set<() => void>();
const requests = new Map<string, Promise<PendingDraftEntry>>();
const retryIds = new Map<string, string>();
const active = new Map<string, DraftController>();
export async function prepareDraftForProfileSwitch(accountId: number | string) {
  const controller = active.get(String(accountId));
  if (!controller || controller.getState().closed) return;
  await controller.flush();
  const { postId, snapshot } = controller.getState();
  if (!postId && Object.keys(snapshot.sections).length) {
    throw new Error('Save or close your current creation before switching profiles.');
  }
}
const notify = () => subscribers.forEach(listener => listener());
export const subscribeDraftEntries = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export const getPendingDraftEntry = (accountId: number | string): PendingDraftEntry | undefined => entries.get(String(accountId));
export const pendingDraftEntry = getPendingDraftEntry;
export function consumePendingDraftEntry(accountId: number | string, requestId?: string): PendingDraftEntry | undefined {
  const key = String(accountId), value = entries.get(key);
  if (value && (!requestId || value.requestId === requestId)) { entries.delete(key); notify(); return value; }
  return undefined;
}
export const usePendingDraftEntry = (accountId: number | string) => useSyncExternalStore(subscribeDraftEntries,
  () => getPendingDraftEntry(accountId), () => undefined);
export function registerActiveDraftController(controller: DraftController): () => void {
  active.set(controller.accountId, controller);
  return () => { if (active.get(controller.accountId) === controller) active.delete(controller.accountId); };
}

/** Adopt the already-fetched winning cloud revision without a conflict dialog. */
export function replaceActiveDraftFromCloud(accountId: string | number, record: DraftRecord, baseUrl?: string) {
  const controller = createDraftController({ accountId, creationProjectId: record.snapshot.creationProjectId,
    creationType: record.snapshot.creationType, record, baseUrl });
  const entry: PendingDraftEntry = { requestId: newRequestId(), mode: 'resume', record, controller };
  entries.set(String(accountId), entry); notify();
}
export const creationDraftPath = (record: DraftRecord): '/images' | '/kickit' | '/clikit' =>
  record.snapshot.creationType === 1 ? '/kickit' : record.snapshot.creationType === 3 ? '/clikit' : '/images';

const newRequestId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function reconcilePending(accountId: string, record: DraftRecord, api: DraftApi, storage?: DraftStorage | null): Promise<DraftRecord> {
  let local = storage;
  try { if (local === undefined) local = typeof localStorage === 'undefined' ? null : localStorage; } catch { local = null; }
  let pending: any, working: any, envelope: any;
  const localKey = `clik-creation-draft:v1:${accountId}:${record.snapshot.creationProjectId}`;
  try { envelope = JSON.parse(local?.getItem(localKey) || 'null'); }
  catch { /* An unreadable local cache cannot replace an authorized cloud read. */ }
  const backup = await readDraftBackup(localKey);
  if (backup && (!envelope || Number(backup.updatedAt) > Number(envelope.updatedAt))) envelope = backup;
  if (envelope?.accountId === accountId && envelope?.outbox?.creationProjectId === record.snapshot.creationProjectId
    && envelope.outbox.expectedRevision === record.revision) { pending = envelope.outbox; working = envelope.snapshot; }
  if (!pending) return record;
  try {
    const retried = await api.checkpoint(pending);
    // Accepted edits can have accumulated behind the retained in-flight save.
    // Sync that complete working state only while its original cloud base was
    // unchanged; never apply it over a diverged device's latest draft.
    if (working && stableDraftJson(working) !== stableDraftJson(retried.snapshot)) {
      return await api.checkpoint({ creationProjectId: retried.snapshot.creationProjectId, postId: retried.postId,
        expectedRevision: retried.revision, saveId: newRequestId(), action: 'quiet', snapshot: validateDraftSnapshot(working) });
    }
    return retried;
  }
  catch (error) {
    if (error instanceof DraftApiError && error.status === 409) return api.read(record.postId);
    throw error; // Keep the outbox and current creation intact; no false save claim.
  }
}

/** Fetch once at entry, then replay through the one local owner. */
export function prepareDraftEntry(options: {
  accountId: number | string; postId: number; mode: 'resume' | 'remix'; baseUrl?: string;
  api?: DraftApi; requestId?: string; storage?: DraftStorage | null;
}): Promise<PendingDraftEntry> {
  const key = `${options.accountId}:${options.mode}:${options.postId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const api = options.api || createDraftApi(options.baseUrl);
  const requestId = options.requestId || retryIds.get(key) || newRequestId();
  retryIds.set(key, requestId);
  const work = (async () => {
    const previous = active.get(String(options.accountId));
    // Current eligible work must be retained before another owner is activated.
    if (previous && !previous.getState().closed) await previous.flush();
    let record: DraftRecord;
    if (options.mode === 'resume') record = await reconcilePending(String(options.accountId), await api.read(options.postId), api, options.storage);
    else {
      let response = await api.remix(options.postId, requestId);
      const deadline = Date.now() + 5 * 60 * 1000;
      while ((response.state === 'preparing' || response.status === 'preparing') && response.jobId) {
        if (Date.now() >= deadline) throw new Error('Remix is still preparing. Try again to continue the same preparation.');
        await delay(1000);
        response = await api.remixJob(response.jobId);
      }
      if (response.state === 'failed' || response.status === 'failed') throw new Error(response.error || 'Remix media could not be prepared.');
      record = response.document || response;
    }
    if (!record?.snapshot || !record.postId || record.published) throw new Error('This post does not have a resumable creation draft.');
    const controller = createDraftController({ accountId: options.accountId,
      creationProjectId: record.snapshot.creationProjectId, creationType: record.snapshot.creationType,
      record, api, storage: options.storage, baseUrl: options.baseUrl });
    const entry: PendingDraftEntry = { requestId, mode: options.mode, record, controller };
    entries.set(String(options.accountId), entry);
    retryIds.delete(key);
    notify();
    return entry;
  })();
  requests.set(key, work);
  void work.finally(() => { if (requests.get(key) === work) requests.delete(key); }).catch(() => undefined);
  return work;
}
