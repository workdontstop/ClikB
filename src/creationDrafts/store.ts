import { draftJson, stableDraftJson, validateDraftSnapshot, type DraftCheckpointRequest, type DraftRecord, type DraftSection, type DraftSectionName, type DraftSnapshot, type JsonValue } from '../../server/src/creationDrafts/schema';
import { createDraftApi, DraftApiError, type DraftApi } from './api';
import { ProtectSavedMediaFromDeleteLater } from '../SavepromptHelpersLocal';
import { writeDraftBackup } from './localBackup';

export interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface DraftState {
  snapshot: DraftSnapshot;
  postId: number | null;
  draftId: string | null;
  revision: number;
  digest: string;
  imageProjectionDigest?: string | null;
  hydrating: boolean;
  saved: boolean;
  isSaving: boolean;
  pending: boolean;
  error: string | null;
  localError: string | null;
  closed: boolean;
  conflicted: boolean;
  version: number;
}
export interface DraftControllerOptions {
  accountId: string | number;
  creationProjectId: string;
  creationType: 0 | 1 | 3;
  record?: DraftRecord;
  baseUrl?: string;
  api?: DraftApi;
  storage?: DraftStorage | null;
  protectMedia?: (snapshot: unknown) => void;
  onCloudReplacement?: (record: DraftRecord) => void;
}
type Envelope = { version: 1; accountId: string; snapshot: DraftSnapshot; postId: number | null; draftId: string | null; revision: number; digest: string; confirmed: string; outbox?: DraftCheckpointRequest; updatedAt: number };
const requestId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageForBrowser = (): DraftStorage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const message = (error: unknown) => error instanceof Error ? error.message : 'Creation draft could not be saved.';

/** One complete creation owner, independent of conditional scene/editor mounts. */
export class DraftController {
  readonly accountId: string;
  readonly creationProjectId: string;
  private state: DraftState;
  private api: DraftApi;
  private storage: DraftStorage | null;
  private confirmed = '';
  private listeners = new Set<() => void>();
  private notifyQueued = false;
  private localTimer: ReturnType<typeof setTimeout> | null = null;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private outbox?: DraftCheckpointRequest;
  private pendingWrites = 0;
  private closing = false;
  private closeWork?: Promise<void>;
  private backupWork: Promise<void> = Promise.resolve();
  private operations = new Map<string, Promise<DraftRecord>>();
  private onCloudReplacement?: (record: DraftRecord) => void;
  private protect: (value: unknown) => void;

  constructor(options: DraftControllerOptions) {
    this.accountId = String(options.accountId);
    this.creationProjectId = options.creationProjectId;
    this.api = options.api || createDraftApi(options.baseUrl);
    this.storage = options.storage === undefined ? storageForBrowser() : options.storage;
    this.protect = options.protectMedia || ProtectSavedMediaFromDeleteLater;
    this.onCloudReplacement = options.onCloudReplacement;
    const record = options.record;
    const snapshot = record ? validateDraftSnapshot(record.snapshot) : validateDraftSnapshot({
      schemaVersion: 1, creationProjectId: options.creationProjectId, creationType: options.creationType, sections: {},
    });
    if (snapshot.creationProjectId !== options.creationProjectId) throw new Error('Draft identity does not match this creation.');
    if (record) this.confirmed = stableDraftJson(snapshot);
    this.state = { snapshot, postId: record?.postId || null, draftId: record?.draftId || null,
      revision: record?.revision || 0, digest: record?.digest || '', imageProjectionDigest: record?.imageProjectionDigest, hydrating: !!record,
      saved: !!record, isSaving: false, pending: false, error: null, localError: null,
      closed: false, conflicted: false, version: 0 };
    // A cloud-first entry never silently hydrates stale local content. Retain
    // a retry receipt only if it was based on this exact confirmed revision.
    if (record) {
      const envelope = this.readEnvelope();
      if (envelope?.outbox && envelope.outbox.expectedRevision === record.revision) this.outbox = envelope.outbox;
      // A lost successful response is already included in the newer cloud data.
      if (this.outbox && stableDraftJson(this.outbox.snapshot) === this.confirmed) this.outbox = undefined;
      this.protect(snapshot);
    }
  }
  private key = () => `clik-creation-draft:v1:${this.accountId}:${this.creationProjectId}`;
  private readEnvelope(): Envelope | null {
    try {
      const raw = this.storage?.getItem(this.key());
      if (!raw) return null;
      const value = JSON.parse(raw) as Envelope;
      return value.version === 1 && value.accountId === this.accountId
        && value.snapshot.creationProjectId === this.creationProjectId ? value : null;
    } catch { return null; }
  }
  getState = (): DraftState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  section<T = DraftSection>(name: DraftSectionName): T | undefined {
    const section = this.state.snapshot.sections[name];
    return section ? clone(section) as T : undefined;
  }
  private update(patch: Partial<DraftState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    if (!this.notifyQueued) {
      this.notifyQueued = true;
      queueMicrotask(() => { this.notifyQueued = false; this.listeners.forEach(listener => listener()); });
    }
  }
  beginHydration() { this.update({ hydrating: true }); }
  endHydration() {
    this.update({ hydrating: false });
    this.flushLocal();
    // Retry an unsent local operation only when the cloud base is unchanged.
    // The new UI is not allowed to replace the cloud version until it succeeds.
    if (this.outbox) {
      const pending = this.outbox;
      void this.enqueue(pending).catch(() => undefined);
    }
  }
  capture(name: DraftSectionName, patch: Record<string, unknown>, options: { quiet?: boolean } = {}): boolean {
    if (this.closing || this.state.hydrating || this.state.closed || this.state.conflicted) return false;
    const safe = draftJson(patch);
    if (!safe || Array.isArray(safe) || typeof safe !== 'object') return false;
    const section = { ...(this.state.snapshot.sections[name] || {}), ...safe };
    if (stableDraftJson(section) === stableDraftJson(this.state.snapshot.sections[name] || {})) return false;
    const snapshot = validateDraftSnapshot({ ...this.state.snapshot, sections: { ...this.state.snapshot.sections, [name]: section } });
    if (stableDraftJson(snapshot) === stableDraftJson(this.state.snapshot)) return false;
    this.protect(safe);
    const saved = !!this.state.postId && stableDraftJson(snapshot) === this.confirmed && !this.pendingWrites && !this.outbox;
    this.update({ snapshot, saved, pending: !!this.state.postId && !saved, error: null });
    this.scheduleLocal();
    if (options.quiet && this.state.postId) this.scheduleQuiet();
    return true;
  }
  /** A deliberate new plan invalidates results, while the unpublished post keeps its identity. */
  resetDependentSections() {
    if (this.closing || this.state.hydrating || this.state.closed || this.state.conflicted) return;
    const snapshot = validateDraftSnapshot({ ...this.state.snapshot, sections: { prompt: this.state.snapshot.sections.prompt || {} } });
    this.update({ snapshot, saved: false, pending: !!this.state.postId, imageProjectionDigest: null });
    this.scheduleLocal();
  }
  private scheduleLocal() {
    if (this.localTimer) clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => { this.localTimer = null; this.flushLocal(); }, 350);
  }
  private scheduleQuiet() {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = setTimeout(() => { this.quietTimer = null; void this.checkpoint('quiet').catch(() => undefined); }, 500);
  }
  flushLocal() {
    if (this.localTimer) { clearTimeout(this.localTimer); this.localTimer = null; }
    const envelope: Envelope = { version: 1, accountId: this.accountId, snapshot: this.state.snapshot,
      postId: this.state.postId, draftId: this.state.draftId, revision: this.state.revision,
      digest: this.state.digest, confirmed: this.confirmed, outbox: this.outbox, updatedAt: Date.now() };
    try {
      if (!this.storage) throw new Error('Local draft storage is unavailable.');
      this.storage.setItem(this.key(), JSON.stringify(envelope));
      if (this.state.postId) this.storage.setItem(`clik-creation-draft:v1:${this.accountId}:post:${this.state.postId}`, this.creationProjectId);
      if (this.state.localError) this.update({ localError: null });
    } catch (error) {
      if (this.state.localError !== message(error)) this.update({ localError: message(error) });
      this.backupWork = this.backupWork.catch(() => undefined).then(() => writeDraftBackup(this.key(), envelope))
        .then(() => { if (this.state.localError) this.update({ localError: null }); }).catch(() => undefined);
    }
  }
  checkpoint(action: DraftCheckpointRequest['action'], projection?: Record<string, unknown>): Promise<DraftRecord> {
    if (this.state.hydrating || this.state.conflicted || this.state.closed) return Promise.reject(new Error('Creation draft is not ready to save.'));
    if (!this.state.postId && action !== 'images') return Promise.reject(new Error('Use image Continue before cloud saving this creation.'));
    if (this.quietTimer) { clearTimeout(this.quietTimer); this.quietTimer = null; }
    const snapshot = clone(this.state.snapshot);
    const cleanProjection = projection ? draftJson(projection) as Record<string, JsonValue> : undefined;
    const signature = stableDraftJson([action, snapshot, cleanProjection || null]);
    const active = this.operations.get(signature);
    if (active) return active;
    // Only a known confirmed image checkpoint may be skipped. A first images
    // projection after resume is harmlessly idempotent on the server.
    if (this.state.postId && stableDraftJson(snapshot) === this.confirmed && !this.outbox && !this.pendingWrites
      && (action === 'quiet' || (action === 'images' && !!cleanProjection
        && this.state.imageProjectionDigest === stableDraftJson(cleanProjection)))) {
      return Promise.resolve(this.asRecord());
    }
    const operation: DraftCheckpointRequest = { creationProjectId: this.creationProjectId, postId: this.state.postId || undefined,
      saveId: requestId(), expectedRevision: this.state.revision, snapshot, action, projection: cleanProjection };
    const work = this.enqueue(operation);
    this.operations.set(signature, work);
    void work.finally(() => { if (this.operations.get(signature) === work) this.operations.delete(signature); }).catch(() => undefined);
    return work;
  }
  private asRecord(): DraftRecord {
    return { postId: this.state.postId!, draftId: this.state.draftId!, revision: this.state.revision,
      digest: this.state.digest, imageProjectionDigest: this.state.imageProjectionDigest, snapshot: this.state.snapshot, published: false };
  }
  private enqueue(operation: DraftCheckpointRequest): Promise<DraftRecord> {
    this.pendingWrites++;
    this.update({ isSaving: true, pending: true, saved: false, error: null });
    const run = this.chain.catch(() => undefined).then(async () => {
      if (this.state.conflicted) throw new Error('A newer cloud draft was loaded.');
      try {
        // A lost response must retry its original save identity before any
        // newer queued write. The server may already have committed it.
        if (this.outbox && this.outbox.saveId !== operation.saveId) {
          const retained = await this.api.checkpoint(this.outbox);
          this.acceptRecord(retained);
        }
        // Previous queued writes may have just created the post or advanced its
        // revision. This owner supplies the new base, never parallel scene queues.
        const request = { ...operation, postId: this.state.postId || operation.postId, expectedRevision: this.state.revision };
        this.outbox = request;
        this.flushLocal();
        const record = await this.api.checkpoint(request);
        this.acceptRecord(record);
        return record;
      } catch (error) {
        if (error instanceof DraftApiError && error.status === 409 && this.state.postId) {
          const latest = await this.api.read(this.state.postId);
          this.outbox = undefined;
          this.confirmed = stableDraftJson(latest.snapshot);
          this.update({ snapshot: validateDraftSnapshot(latest.snapshot), revision: latest.revision, digest: latest.digest,
            hydrating: true, conflicted: true, saved: false, pending: false,
            error: 'A newer cloud draft is available. Reopen this draft to continue.' });
          this.flushLocal();
          this.onCloudReplacement?.(latest);
        } else {
          this.update({ error: message(error), saved: false, pending: true });
          this.flushLocal();
        }
        throw error;
      }
    }).finally(() => {
      this.pendingWrites--;
      this.update({ isSaving: this.pendingWrites > 0,
        saved: !this.pendingWrites && !this.outbox && !!this.state.postId && !this.state.conflicted && stableDraftJson(this.state.snapshot) === this.confirmed,
        pending: this.pendingWrites > 0 || !!this.outbox || (!!this.state.postId && stableDraftJson(this.state.snapshot) !== this.confirmed) });
    });
    this.chain = run;
    return run;
  }
  private acceptRecord(record: DraftRecord) {
    if (record.snapshot?.creationProjectId !== this.creationProjectId) throw new Error('Saved draft returned the wrong creation identity.');
    this.confirmed = stableDraftJson(record.snapshot);
    this.outbox = undefined;
    this.protect(record.snapshot);
    this.update({ postId: record.postId, draftId: record.draftId, revision: record.revision, digest: record.digest,
      imageProjectionDigest: record.imageProjectionDigest,
      error: null, saved: stableDraftJson(this.state.snapshot) === this.confirmed && this.pendingWrites === 1, pending: false });
    this.flushLocal();
  }
  async flush(): Promise<void> {
    this.flushLocal();
    await this.backupWork;
    if (this.quietTimer) { clearTimeout(this.quietTimer); this.quietTimer = null; }
    await this.chain.catch(() => undefined);
    if (this.outbox && !this.state.hydrating && !this.state.conflicted && !this.state.closed) await this.enqueue(this.outbox);
    if (this.state.postId && !this.state.hydrating && !this.state.conflicted && !this.state.closed
      && (this.outbox || stableDraftJson(this.state.snapshot) !== this.confirmed)) await this.checkpoint('quiet');
  }
  async close(): Promise<void> {
    if (this.closeWork) return this.closeWork;
    this.closing = true;
    this.closeWork = (async () => {
      try { await this.flush(); } finally { this.flushLocal(); this.update({ closed: true }); this.dispose(); }
    })();
    return this.closeWork;
  }
  dispose() {
    if (this.localTimer) clearTimeout(this.localTimer);
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.localTimer = this.quietTimer = null;
  }
}
export const createDraftController = (options: DraftControllerOptions) => new DraftController(options);
