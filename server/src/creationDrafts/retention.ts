import { createHash } from 'crypto';
import execQuery, { type TransactionQuery } from '../execQuery';

const missingTable = (error: any) => error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
export const creationAssetHash = (canonicalUrl: string) => createHash('sha256').update(canonicalUrl).digest('hex');

/** Referencing a library/World/track in a draft does not transfer its deletion ownership. */
export async function isCreationLibraryAsset(canonicalUrl: string, query: TransactionQuery = execQuery): Promise<boolean> {
  const key = canonicalUrl.replace(/^s3:\/\/[^/]+\//, '');
  const pattern = `%${key.replace(/[\\%_]/g, '\\$&')}%`;
  for (const [sql, parameters] of [
    ['SELECT id FROM music WHERE song LIKE ? LIMIT 1', [pattern]],
    ['SELECT id FROM characters WHERE image LIKE ? LIMIT 1', [pattern]],
    ['SELECT id FROM world_models WHERE cover LIKE ? LIMIT 1', [pattern]],
    ['SELECT id FROM templates4prompt WHERE template_image LIKE ? LIMIT 1', [pattern]],
    ['SELECT id FROM image_model_example_sets WHERE model_images LIKE ? LIMIT 1', [pattern]],
    ['SELECT id FROM members WHERE profile_image LIKE ? OR profile_image_thumb LIKE ? OR billboard1 LIKE ? OR billboardthumb1 LIKE ? OR billboard2 LIKE ? OR billboardthumb2 LIKE ? LIMIT 1', Array(6).fill(pattern)],
  ] as const) {
    try { if ((await query(sql, [...parameters])).length) return true; }
    catch (error: any) { if (!missingTable(error)) throw error; }
  }
  return false;
}

/** Background cleanup cannot delete assets retained by any complete draft. */
export async function isCreationAssetRetained(canonicalUrl: string, query: TransactionQuery = execQuery): Promise<boolean> {
  try {
    const rows = await query('SELECT draft_id FROM creation_draft_assets WHERE asset_hash=? LIMIT 1', [creationAssetHash(canonicalUrl)]);
    return rows.length > 0;
  } catch (error) { if (missingTable(error)) return false; throw error; }
}

/** Called within explicit post deletion after the posts row is locked. */
export async function creationDraftDeletion(query: TransactionQuery, postId: number): Promise<{ urls: string[]; finish: () => Promise<void> }> {
  try {
    const active = await query("SELECT job_id FROM creation_remix_jobs WHERE (source_post_id=? OR post_id=?) AND status='preparing' LIMIT 1 FOR UPDATE", [postId, postId]);
    if (active.length) throw new Error('The source is being copied into an independent remix. Try deletion after preparation finishes.');
    const drafts = await query('SELECT draft_id FROM creation_drafts WHERE post_id=? FOR UPDATE', [postId]);
    const urls: string[] = [];
    for (const row of drafts) {
      const musicFields = new Set(['music', 'musicUrl', 'storyBgMusicUrl', 'promptMusicUrl', 'musicModeUrl', 'appBgMusicUrl']);
      const draftMusicUrls = new Set<string>();
      try {
        let snapshotData = row.snapshot;
        if (!snapshotData) {
          try {
            const sRows = await query('SELECT snapshot FROM creation_drafts WHERE draft_id=?', [row.draft_id]);
            if (sRows?.[0]?.snapshot) snapshotData = sRows[0].snapshot;
          } catch { /* ignore */ }
        }
        const data = typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
        const sections = data?.sections || data;
        for (const section of Object.values(sections || {})) {
          if (!section || typeof section !== 'object') continue;
          for (const [k, v] of Object.entries(section)) {
            if (musicFields.has(k) && typeof v === 'string') draftMusicUrls.add(v);
          }
        }
      } catch { /* safe parse */ }
      const assets = await query('SELECT asset_hash,asset_url FROM creation_draft_assets WHERE draft_id=?', [row.draft_id]);
      for (const asset of assets) {
        if (draftMusicUrls.has(asset.asset_url)) continue;
        const others = await query('SELECT draft_id FROM creation_draft_assets WHERE asset_hash=? AND draft_id<>? LIMIT 1', [asset.asset_hash, row.draft_id]);
        if (!others.length && !await isCreationLibraryAsset(asset.asset_url, query)) urls.push(asset.asset_url);
      }
    }
    const copies = await query("SELECT copy_map FROM creation_remix_jobs WHERE post_id=? AND status<>'ready'", [postId]);
    for (const job of copies) { try { urls.push(...Object.values(JSON.parse(job.copy_map || '{}')).filter((url): url is string => typeof url === 'string')); } catch { /* Preserve unreadable records for diagnosis. */ } }
    return { urls, finish: async () => {
      for (const row of drafts) await query('DELETE FROM creation_draft_assets WHERE draft_id=?', [row.draft_id]);
      await query('DELETE FROM creation_remix_jobs WHERE post_id=?', [postId]);
      await query('DELETE FROM creation_draft_operations WHERE creation_id IN (SELECT creation_id FROM creation_drafts WHERE post_id=?)', [postId]);
      await query('DELETE FROM creation_drafts WHERE post_id=?', [postId]);
    } };
  } catch (error) {
    if (missingTable(error)) return { urls: [], finish: async () => {} };
    throw error;
  }
}

/** Old schemas stay readable during an additive rollout. */
export function draftsNotInstalled(error: any): boolean {
  return missingTable(error) || error?.code === 'ER_BAD_FIELD_ERROR' || error?.errno === 1054;
}
