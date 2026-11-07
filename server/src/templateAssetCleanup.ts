import execQuery, { withTransaction, type TransactionQuery } from './execQuery';
import { deleteCloudImageUrl, postMediaStorageUrl } from './S3Routes';

// Durable work items use the existing template storage, and are excluded from the catalog.
export const TEMPLATE_ASSET_CLEANUP = '__CLIKB_TEMPLATE_ASSET_CLEANUP__';
export async function queueTemplateAssetCleanup(url: string, query: TransactionQuery = execQuery, delaySeconds = 0) {
  if (!url || url.includes('/clik-bg.png') || !postMediaStorageUrl(url)) return;
  await query(`INSERT INTO templates4prompt (userid,title,template_prompt,template_image,artstyle,time)
    VALUES (1,?,?, '', '{}', DATE_ADD(NOW(), INTERVAL ? SECOND))`,
  [TEMPLATE_ASSET_CLEANUP, JSON.stringify({ url }), delaySeconds]);
}

let running: Promise<void> | undefined;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;
export function startTemplateAssetCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => void drainTemplateAssetCleanup(), 15 * 60_000);
  cleanupTimer.unref();
}
export function drainTemplateAssetCleanup(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const jobs: any[] = await execQuery(`SELECT id,template_prompt FROM templates4prompt WHERE title = ? AND time <= NOW() ORDER BY id LIMIT 30`, [TEMPLATE_ASSET_CLEANUP]);
    for (const job of jobs) {
      try {
        await withTransaction(async query => {
          const [pending] = await query('SELECT id,template_prompt FROM templates4prompt WHERE id=? AND title=? FOR UPDATE', [job.id, TEMPLATE_ASSET_CLEANUP]);
          if (!pending) return;
          const { url } = JSON.parse(pending.template_prompt);
          const canonical = postMediaStorageUrl(url);
          if (!canonical) return;
          // Match the object key, including alternate regional URLs and signed URLs.
          const key = canonical.replace(/^s3:\/\/[^/]+\//, '');
          const pattern = `%${key.replace(/[\\%_]/g, '\\$&')}%`;
          const references: any[] = await query(`SELECT id FROM templates4prompt WHERE template_image LIKE ? LIMIT 1`, [pattern]);
          const postMedia = ['thumb1', 'item1', 'item2', 'kontext',
            ...['x', 'xh', 'xt'].flatMap(prefix => Array.from({ length: 9 }, (_, index) => index + 1)
              .flatMap(index => [`${prefix}${index}`, `${prefix}${index}B`]))];
          const posts: any[] = await query(`SELECT id FROM posts WHERE ${postMedia.map(column => `\`${column}\` LIKE ?`).join(' OR ')} LIMIT 1`, postMedia.map(() => pattern));
          const characters: any[] = await query(`SELECT id FROM characters WHERE image LIKE ? LIMIT 1`, [pattern]);
          const worlds: any[] = await query(`SELECT id FROM world_models WHERE cover LIKE ? LIMIT 1`, [pattern]);
          const profiles: any[] = await query(`SELECT id FROM members WHERE profile_image LIKE ? OR profile_image_thumb LIKE ? OR billboard1 LIKE ? OR billboardthumb1 LIKE ? OR billboard2 LIKE ? OR billboardthumb2 LIKE ? LIMIT 1`, [pattern, pattern, pattern, pattern, pattern, pattern]);
          if (!references.length && !posts.length && !characters.length && !worlds.length && !profiles.length) await deleteCloudImageUrl(url);
          await query('DELETE FROM templates4prompt WHERE id = ? AND title = ?', [job.id, TEMPLATE_ASSET_CLEANUP]);
        });
      } catch (error) {
        // Keep the durable work item for the next catalog request after an S3/DB failure.
        console.warn('Template cover cleanup will retry:', error instanceof Error ? error.message : error);
      }
    }
  })().catch(error => { console.warn('Template cleanup queue unavailable:', error?.message); }).finally(() => { running = undefined; });
  return running;
}
