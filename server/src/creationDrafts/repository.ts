import { createHash, randomUUID } from 'crypto';
import type { TransactionQuery } from '../execQuery';
import { canWriteCreativeProfileContent } from '../creativeProfileContent';
import { DRAFT_POST_VIDEO } from '../postPublication';
import { applyQuietProjection, mergeImageContext } from './projection';
import { draftJson, draftMediaUrls, operationalDraftMediaUrls, remapDraftMedia, stableDraftJson, validateDraftSnapshot, type DraftCapabilities, type DraftCheckpointRequest, type DraftRecord, type DraftSnapshot } from './schema';

export type DraftActor = { id: string; ownerId?: string | null; development: boolean; guestScope: string | null };
export class DraftError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
async function checkProfileWrite(query: TransactionQuery, actor: DraftActor) {
  if (actor.ownerId && actor.ownerId !== actor.id && !await canWriteCreativeProfileContent(query, actor.id)) {
    throw new DraftError(409, 'CREATIVE_PROFILE_REMOVED', 'This Creative Profile has been removed.');
  }
}
type Dependencies = {
  query: TransactionQuery;
  transaction: <T>(work: (query: TransactionQuery) => Promise<T>) => Promise<T>;
  canonicalMedia: (url: unknown) => string | null;
  copyMedia: (source: string, creationId: string, assetId: string) => Promise<string>;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const positiveId = (value: unknown): number => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new DraftError(400, 'INVALID_POST', 'A valid post ID is required.');
  return id;
};
const operationId = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(value)) throw new DraftError(400, 'INVALID_SAVE', 'A valid save identity is required.');
  return value;
};
const ownDraft = (row: any, actor: DraftActor): boolean => String(row.user_id) === actor.id
  && (actor.id !== '1' || actor.development || Boolean(actor.guestScope && row.guest_scope === actor.guestScope));
export function remixPermissions(ownerId: unknown, allow: unknown, actor: DraftActor) {
  const owner = String(ownerId) === actor.id;
  const guest = actor.id === '1';
  return { owner, canRemix: guest ? actor.development || Boolean(Number(allow)) : owner || Boolean(Number(allow)),
    canToggleRemix: owner && (!guest || actor.development) };
}
function document(row: any): DraftRecord {
  return { postId: Number(row.post_id), draftId: row.draft_id, revision: Number(row.revision), digest: row.digest,
    snapshot: validateDraftSnapshot(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot),
    published: row.lifecycle === 'published' || Number(row.video) !== DRAFT_POST_VIDEO,
    imageProjectionDigest: row.image_projection_digest || null };
}
const projectionColumns = new Set(['caption', 'prompt', 'model', 'ratio', 'item1', 'thumb1', 'topic', 'kontext', 'intent_blueprint_json', 'bshot', 'interaction_format']);
for (const prefix of ['x', 'xh', 'xt', 'gent', 'xv', 'xa']) for (let n = 1; n <= 9; n++) for (const suffix of ['', 'B']) projectionColumns.add(`${prefix}${n}${suffix}`);

/** Map legacy post payloads to explicit trusted columns, without unrelated fields. */
export function imageProjection(values: Record<string, any>, type: number): Record<string, any> {
  const output: Record<string, any> = {};
  for (const key of ['caption', 'prompt', 'model', 'ratio', 'topic']) if (values[key] !== undefined) output[key] = values[key];
  if (values.kontext !== undefined) output.kontext = values.kontext;
  if (values.intentBlueprintJson !== undefined) output.intent_blueprint_json = values.intentBlueprintJson;
  if (values.imagehd) output.item1 = values.imagehd;
  const count = type === 1 ? 18 : 9;
  for (let index = 0; index < count; index++) {
    const col = type === 1 ? `${Math.floor(index / 2) + 1}${index % 2 ? 'B' : ''}` : String(index + 1);
    for (const [input, prefix] of [['image', 'x'], ['imageHd', 'xh'], ['txt', 'xt'], ['GeneratedText', 'gent']]) {
      // Full image checkpoints deliberately clear removed positions.
      output[`${prefix}${col}`] = values[`${input}${index + 1}`] ?? (index === 0 && input === 'imageHd' ? values.imagehd ?? null : null);
    }
  }
  // Both column groups must be cleared when switching out of Cinema.
  if (type !== 1) for (let index = 1; index <= 9; index++) for (const prefix of ['x', 'xh', 'xt', 'gent']) output[`${prefix}${index}B`] = null;
  if (!output.item1 && output.x1) output.item1 = output.x1;
  return output;
}
async function updateProjection(query: TransactionQuery, postId: number, projection: Record<string, any>) {
  const columns = Object.entries(projection).filter(([key, value]) => projectionColumns.has(key) && value !== undefined);
  if (columns.length) await query(`UPDATE posts SET ${columns.map(([key]) => `${key}=?`).join(',')} WHERE id=?`, [...columns.map(([, value]) => value), postId]);
}

export function createDraftRepository(deps: Dependencies) {
  const assetEntries = (value: unknown) => [...new Set(draftMediaUrls(value).map(deps.canonicalMedia).filter((url): url is string => Boolean(url)))];
  const claims = async (query: TransactionQuery, draftId: string, snapshot: DraftSnapshot, additional?: unknown) => {
    await query('DELETE FROM creation_draft_assets WHERE draft_id=?', [draftId]);
    for (const url of assetEntries([snapshot, additional])) await query('INSERT INTO creation_draft_assets (draft_id,asset_hash,asset_url) VALUES (?,?,?)', [draftId, hash(url), url]);
  };
  const recordFor = async (query: TransactionQuery, postId: number, lock = false) => (await query(
    `SELECT d.*,p.sender,p.video,p.allow_remix FROM creation_drafts d JOIN posts p ON p.id=d.post_id WHERE d.post_id=?${lock ? ' FOR UPDATE' : ''}`, [postId]))[0];
  const read = async (actor: DraftActor, postId: number): Promise<DraftRecord> => {
    const row = await recordFor(deps.query, positiveId(postId));
    if (!row || !ownDraft(row, actor) || row.preparation_state !== 'ready') throw new DraftError(404, 'DRAFT_NOT_FOUND', 'Draft not found or not owned by this session.');
    return document(row);
  };
  const capabilities = async (actor: DraftActor, postId: number): Promise<DraftCapabilities> => {
    const post = (await deps.query('SELECT id,sender,video,allow_remix FROM posts WHERE id=?', [positiveId(postId)]))[0];
    if (!post) throw new DraftError(404, 'POST_NOT_FOUND', 'Post not found.');
    const row = await recordFor(deps.query, postId);
    const isDraft = Number(post.video) === DRAFT_POST_VIDEO, draftReady = Boolean(row && row.preparation_state === 'ready');
    const permissions = remixPermissions(post.sender, post.allow_remix, actor);
    return { postId, isDraft, draftReady: draftReady && (!isDraft || Boolean(row && ownDraft(row, actor))),
      owner: permissions.owner, ownerId: String(post.sender), creationType: row ? document(row).snapshot.creationType : undefined,
      allowRemix: Boolean(Number(post.allow_remix)),
      canResume: isDraft && draftReady && Boolean(row && ownDraft(row, actor)),
      canRemix: !isDraft && draftReady && permissions.canRemix,
      canToggleRemix: !isDraft && permissions.canToggleRemix };
  };
  const checkpoint = async (actor: DraftActor, request: DraftCheckpointRequest): Promise<DraftRecord & { go: number }> => {
    const snapshot = validateDraftSnapshot(request.snapshot);
    if (snapshot.creationProjectId !== request.creationProjectId) throw new DraftError(400, 'IDENTITY_MISMATCH', 'Creation identity does not match the snapshot.');
    if (!['images', 'quiet', 'publish'].includes(request.action)) throw new DraftError(400, 'INVALID_ACTION', 'Invalid draft checkpoint.');
    operationId(request.saveId);
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) throw new DraftError(400, 'INVALID_REVISION', 'Invalid expected revision.');
    if (actor.id === '1' && !actor.development && !actor.guestScope) throw new DraftError(403, 'GUEST_SCOPE_REQUIRED', 'Guest draft session is required.');
    return deps.transaction(async query => {
      await checkProfileWrite(query, actor);
      const oldOperation = (await query('SELECT response FROM creation_draft_operations WHERE user_id=? AND creation_id=? AND operation_id=?', [actor.id, request.creationProjectId, request.saveId]))[0];
      if (oldOperation) {
        const receipt = JSON.parse(oldOperation.response);
        const owned = await recordFor(query, receipt.postId, true);
        if (!owned || !ownDraft(owned, actor)) throw new DraftError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
        if (receipt.digest !== hash(stableDraftJson(snapshot))) throw new DraftError(409, 'SAVE_ID_REUSED', 'This save identity already belongs to different content.');
        return { ...receipt, snapshot };
      }
      let row = (await query('SELECT * FROM creation_drafts WHERE user_id=? AND creation_id=? FOR UPDATE', [actor.id, request.creationProjectId]))[0];
      let postId: number, draftId: string;
      if (!row) {
        if (request.action !== 'images' || request.expectedRevision !== 0) throw new DraftError(409, 'INITIAL_CHECKPOINT_REQUIRED', 'Continue from the image grid to save this creation.');
        if (request.postId) {
          postId = positiveId(request.postId);
          const post = (await query('SELECT id,sender,video FROM posts WHERE id=? FOR UPDATE', [postId]))[0];
          if (!post || String(post.sender) !== actor.id || Number(post.video) !== DRAFT_POST_VIDEO) throw new DraftError(403, 'POST_NOT_OWNED', 'Only your unpublished creation can be saved.');
        } else {
          const projection = request.projection || {};
          const inserted = await query('INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,time,private,mode,prompt,model,ratio,video,allow_remix) VALUES (?,1,?,?,?,?,?,1,?,?,?,?,?,0)', [actor.id,
            projection.topic || '', projection.caption || '', projection.image1 || projection.imagehd || '', '', new Date(), snapshot.creationType === 3 ? 2 : snapshot.creationType,
            projection.prompt || '', projection.model || '', projection.ratio || 0, DRAFT_POST_VIDEO]);
          postId = Number(inserted.insertId);
        }
        draftId = randomUUID();
        row = { draft_id: draftId, user_id: actor.id, creation_id: request.creationProjectId, post_id: postId, guest_scope: actor.guestScope, revision: 0, lifecycle: 'unpublished', preparation_state: 'ready' };
        await query('INSERT INTO creation_drafts (draft_id,user_id,creation_id,post_id,guest_scope,revision,digest,snapshot) VALUES (?,?,?,?,?,0,?,?)', [draftId, actor.id, request.creationProjectId, postId, actor.guestScope, '', JSON.stringify(snapshot)]);
      } else {
        if (!ownDraft(row, actor) || (request.postId && Number(row.post_id) !== Number(request.postId))) throw new DraftError(403, 'IDENTITY_MISMATCH', 'Draft identity is not owned by this session.');
        postId = Number(row.post_id); draftId = row.draft_id;
        if (row.preparation_state !== 'ready') throw new DraftError(409, 'REMIX_PREPARING', 'Remix is still being prepared.');
      }
      if (Number(row.revision) !== request.expectedRevision) throw new DraftError(409, 'DRAFT_CONFLICT', 'A newer cloud draft is available. Reload the latest draft.');
      const post = (await query('SELECT id,sender,video FROM posts WHERE id=? FOR UPDATE', [postId]))[0];
      if (!post || String(post.sender) !== actor.id) throw new DraftError(403, 'POST_NOT_OWNED', 'Draft post is not owned by you.');
      if (Number(post.video) !== DRAFT_POST_VIDEO || row.lifecycle === 'published') throw new DraftError(409, 'PUBLISHED_SOURCE', 'Published creations must be remixed before editing.');
      const digest = hash(stableDraftJson(snapshot)), revision = Number(row.revision) + 1;
      let receipt: Record<string, any> = {};
      let imageProjectionDigest = row.image_projection_digest || null;
      if (request.action === 'images') {
        const values = (request.projection as any)?.values || request.projection || {};
        const projection = imageProjection(values, snapshot.creationType);
        if (projection.kontext != null) {
          const old = (await query('SELECT kontext FROM posts WHERE id=?', [postId]))[0];
          projection.kontext = mergeImageContext(old?.kontext, projection.kontext);
        }
        await updateProjection(query, postId, projection);
        imageProjectionDigest = stableDraftJson(request.projection || {});
      } else if (request.action === 'publish') receipt = await applyQuietProjection(query, postId, { kind: 'topology', values: { snapshot } });
      else if (request.projection) receipt = await applyQuietProjection(query, postId,
        request.projection.kind === 'topology' ? { kind: 'topology', values: { snapshot } } : request.projection);
      // 'publish' is a pre-publication checkpoint, not a replacement for final metadata/render gates.
      await query('UPDATE creation_drafts SET revision=?,digest=?,snapshot=?,image_projection_digest=? WHERE draft_id=?', [revision, digest, JSON.stringify(snapshot), imageProjectionDigest, draftId]);
      await claims(query, draftId, snapshot);
      const result = { postId, go: postId, draftId, revision, digest, snapshot, published: false, imageProjectionDigest, ...receipt };
      await query('INSERT INTO creation_draft_operations (user_id,creation_id,operation_id,kind,response) VALUES (?,?,?,?,?)', [actor.id, request.creationProjectId, request.saveId, request.action,
        JSON.stringify({ ...result, snapshot: undefined })]);
      return result;
    });
  };
  const allowRemix = async (actor: DraftActor, postId: number, allow: boolean) => deps.transaction(async query => {
    const post = (await query('SELECT id,sender,video,allow_remix FROM posts WHERE id=? FOR UPDATE', [positiveId(postId)]))[0];
    if (!post || !remixPermissions(post.sender, post.allow_remix, actor).canToggleRemix || Number(post.video) === DRAFT_POST_VIDEO) throw new DraftError(403, 'REMIX_PERMISSION', 'Only the permitted owner can change remix permission.');
    await query('UPDATE posts SET allow_remix=? WHERE id=? AND sender=?', [allow ? 1 : 0, postId, actor.id]);
    return { postId, allowRemix: allow };
  });

  const prepareRemix = async (actor: DraftActor, sourcePostId: number, requestId: string) => {
    operationId(requestId); positiveId(sourcePostId);
    return deps.transaction(async query => {
      await checkProfileWrite(query, actor);
      const existing = (await query('SELECT * FROM creation_remix_jobs WHERE user_id=? AND request_id=? FOR UPDATE', [actor.id, requestId]))[0];
      if (existing) {
        if (actor.id === '1' && !actor.development && existing.guest_scope !== actor.guestScope) throw new DraftError(403, 'GUEST_SCOPE_REQUIRED', 'Remix job belongs to another session.');
        if (Number(existing.source_post_id) !== sourcePostId) throw new DraftError(409, 'REMIX_REQUEST_REUSED', 'This request identity belongs to a different source post.');
        if (existing.status === 'failed') {
          await query("UPDATE creation_remix_jobs SET status='preparing',error_code=NULL WHERE job_id=?", [existing.job_id]);
          existing.status = 'preparing';
        }
        return existing;
      }
      const source = (await query('SELECT * FROM posts WHERE id=? FOR UPDATE', [sourcePostId]))[0];
      if (!source || Number(source.video) === DRAFT_POST_VIDEO || !remixPermissions(source.sender, source.allow_remix, actor).canRemix) throw new DraftError(403, 'REMIX_PERMISSION', 'Remix is not allowed for this post.');
      const draft = await recordFor(query, sourcePostId, true);
      if (!draft || draft.preparation_state !== 'ready') throw new DraftError(404, 'SNAPSHOT_UNAVAILABLE', 'This post has no reusable creation snapshot.');
      const sourceSnapshot = document(draft).snapshot;
      if (operationalDraftMediaUrls(sourceSnapshot).some(url => !deps.canonicalMedia(url))) {
        throw new DraftError(409, 'MEDIA_NOT_DURABLE', 'This creation includes media that was not saved to app storage. An independent Remix cannot be prepared.');
      }
      const creationId = `creation:${randomUUID()}`, draftId = randomUUID(), jobId = randomUUID();
      const insert = await query('INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,time,private,mode,video,allow_remix) VALUES (?,1,?,?,?, ?,?,1,?,?,0)', [actor.id, source.topic || '', source.caption || '', '', '', new Date(), source.mode || 0, DRAFT_POST_VIDEO]);
      const postId = Number(insert.insertId);
      const frozenProjection = Object.fromEntries(Object.entries(source).filter(([key]) => projectionColumns.has(key)));
      if (typeof frozenProjection.kontext === 'string') {
        try { frozenProjection.kontext = JSON.stringify(draftJson(JSON.parse(frozenProjection.kontext))); }
        catch { /* Legacy textual creative context is preserved. */ }
      }
      // Spatial graph/action outputs are excluded, including their legacy rendered video columns.
      if (sourceSnapshot.sections.prompt?.interactionExperienceMode === 'spatial') {
        for (const key of Object.keys(frozenProjection)) if (key.startsWith('xv') || key === 'interaction_format') delete frozenProjection[key];
      }
      const initial = { ...sourceSnapshot, creationProjectId: creationId };
      await query('INSERT INTO creation_drafts (draft_id,user_id,creation_id,post_id,guest_scope,revision,digest,snapshot,preparation_state,source_post_id,source_revision) VALUES (?,?,?,?,?,0,?,?,\'preparing\',?,?)', [draftId, actor.id, creationId, postId, actor.guestScope, '', JSON.stringify(initial), sourcePostId, draft.revision]);
      const job = { job_id: jobId, user_id: actor.id, guest_scope: actor.guestScope, request_id: requestId, source_post_id: sourcePostId, source_revision: draft.revision, draft_id: draftId,
        post_id: postId, creation_id: creationId, source_snapshot: JSON.stringify(sourceSnapshot), source_projection: JSON.stringify(frozenProjection), copy_map: '{}', status: 'preparing' };
      await query('INSERT INTO creation_remix_jobs (job_id,user_id,guest_scope,request_id,source_post_id,source_revision,draft_id,post_id,creation_id,source_snapshot,source_projection,copy_map) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [jobId, actor.id, actor.guestScope, requestId, sourcePostId, draft.revision, draftId, postId, creationId, job.source_snapshot, job.source_projection, '{}']);
      // A failed/restarted preparation still owns the frozen source dependencies.
      // Explicit source deletion must not destroy inputs required by its reserved fork.
      await claims(query, draftId, initial, frozenProjection);
      return job;
    });
  };
  // In-process deduplication complements durable per-object mapping across retries.
  const running = new Map<string, Promise<any>>();
  const finishRemix = (actor: DraftActor, jobId: string): Promise<any> => {
    const runningKey = `${actor.id}:${actor.guestScope || ''}:${jobId}`;
    const pending = running.get(runningKey); if (pending) return pending;
    const work = (async () => {
      let job = (await deps.query('SELECT * FROM creation_remix_jobs WHERE job_id=? AND user_id=?', [jobId, actor.id]))[0];
      if (!job || (actor.id === '1' && !actor.development && job.guest_scope !== actor.guestScope)) throw new DraftError(404, 'REMIX_NOT_FOUND', 'Remix preparation not found.');
      if (job.status === 'ready') { const ready = await read(actor, Number(job.post_id)); return { state: 'ready', status: 'ready', document: ready, ...ready, go: ready.postId }; }
      const snapshot = validateDraftSnapshot(JSON.parse(job.source_snapshot));
      const projection = JSON.parse(job.source_projection);
      const mapping = new Map<string, string>(Object.entries(JSON.parse(job.copy_map || '{}')) as [string, string][]);
      const sources = [...new Set([...draftMediaUrls(snapshot), ...draftMediaUrls(projection)].filter(url => deps.canonicalMedia(url)))];
      try {
        // Copy each canonical object once, even when several query aliases occur.
        for (const source of sources) {
          if (mapping.has(source)) continue;
          const canonical = deps.canonicalMedia(source)!;
          const alias = [...mapping].find(([old]) => deps.canonicalMedia(old) === canonical)?.[1];
          const target = alias || await deps.copyMedia(source, job.creation_id, hash(canonical));
          mapping.set(source, target);
          await deps.query('UPDATE creation_remix_jobs SET copy_map=?,status=\'preparing\',error_code=NULL WHERE job_id=? AND status<>\'ready\'', [JSON.stringify(Object.fromEntries(mapping)), jobId]);
          const canonicalTarget = deps.canonicalMedia(target);
          if (!canonicalTarget) throw new Error('Independent remix copy did not return stored media.');
          await deps.query('INSERT IGNORE INTO creation_draft_assets (draft_id,asset_hash,asset_url) VALUES (?,?,?)', [job.draft_id, hash(canonicalTarget), canonicalTarget]);
        }
        const remapped = validateDraftSnapshot({ ...(remapDraftMedia(snapshot, mapping) as any), creationProjectId: job.creation_id });
        // No operational source post identity may be the remix's write target.
        for (const section of Object.values(remapped.sections)) if (section) {
          for (const key of ['PostId', 'postId', 'projectId']) if (key in section) section[key] = Number(job.post_id);
          if ('creationProjectId' in section) section.creationProjectId = job.creation_id;
        }
        const digest = hash(stableDraftJson(remapped));
        await deps.transaction(async query => {
          const current = (await query('SELECT * FROM creation_remix_jobs WHERE job_id=? FOR UPDATE', [jobId]))[0];
          if (!current || current.status === 'ready') return;
          const target = (await query('SELECT id,sender,video FROM posts WHERE id=? FOR UPDATE', [job.post_id]))[0];
          if (!target || String(target.sender) !== actor.id || Number(target.video) !== DRAFT_POST_VIDEO) throw new DraftError(409, 'REMIX_TARGET_CHANGED', 'Remix target changed during preparation.');
          const remappedProjection = remapDraftMedia(projection, mapping) as Record<string, any>;
          await updateProjection(query, Number(job.post_id), remappedProjection);
          await query('UPDATE creation_drafts SET revision=1,digest=?,snapshot=?,preparation_state=\'ready\' WHERE draft_id=?', [digest, JSON.stringify(remapped), job.draft_id]);
          await claims(query, job.draft_id, remapped, remappedProjection);
          await query('UPDATE creation_remix_jobs SET status=\'ready\',error_code=NULL WHERE job_id=?', [jobId]);
        });
        const ready = await read(actor, Number(job.post_id));
        return { state: 'ready', status: 'ready', document: ready, ...ready, go: ready.postId };
      } catch (error) {
        await deps.query('UPDATE creation_remix_jobs SET status=\'failed\',error_code=\'COPY_RETRY_REQUIRED\' WHERE job_id=? AND status<>\'ready\'', [jobId]);
        throw error;
      }
    })();
    running.set(runningKey, work); void work.finally(() => running.delete(runningKey)).catch(() => {}); return work;
  };
  return { read, capabilities, checkpoint, allowRemix, prepareRemix, finishRemix };
}
