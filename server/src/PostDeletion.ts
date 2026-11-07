import type { Request, Response } from 'express';
import { withTransaction, type TransactionQuery } from './execQuery';
import { authenticatedUserId } from './requestAuth';
import { deleteCloudImageUrl, postMediaStorageUrl } from './S3Routes';
import { cancelSpatialVideo } from './SpatialVideoProvider';
import { collectPostDeletionMedia, parseDeletionDocument } from './postDeletionMedia';
import { creationDraftDeletion, isCreationAssetRetained, isCreationLibraryAsset } from './creationDrafts/retention';
import { pushSocialChange } from './SocialChatSocket';

async function optionalTable(query: TransactionQuery, sql: string, args: unknown[]) {
    try { return await query(sql, args); }
    catch (error: any) {
        // Old installations need no draft-table migration just to delete a post.
        if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) return [];
        throw error;
    }
}

export async function deletePost(req: Request, res: Response): Promise<void> {
    const userId = authenticatedUserId(req), postId = Number(req.body?.postId);
    if (!userId) { res.status(401).json({ error: 'Please sign in.' }); return; }
    if (!Number.isSafeInteger(postId) || postId <= 0) { res.status(400).json({ error: 'A valid postId is required.' }); return; }
    try {
        const deleted = await withTransaction(async query => {
            const posts = await query('SELECT * FROM posts WHERE id=? AND sender=? FOR UPDATE', [postId, userId]);
            if (!posts.length) return false;
            const creation = await creationDraftDeletion(query, postId);
            const drafts = await optionalTable(query, 'SELECT document FROM spatial_world_drafts WHERE post_id=? FOR UPDATE', [postId]);
            const documents = [parseDeletionDocument(posts[0].spatial_experience_json), ...drafts.map((row: any) => parseDeletionDocument(row.document))];
            const jobs = new Map<string, any>();
            for (const doc of documents) {
                const scenes = doc?.scene ? [doc.scene] : Array.isArray(doc?.stages) ? doc.stages.map((stage: any) => stage?.scene) : [];
                for (const scene of scenes) for (const job of Array.isArray(scene?.ledger?.jobs) ? scene.ledger.jobs : []) {
                    if (job.providerJobId && ['submitting', 'generating'].includes(job.status)) jobs.set(`${job.provider}:${job.providerJobId}`, job);
                    if (job.upscale?.providerJobId && job.upscale.endpoint && ['submitting', 'generating'].includes(job.upscale.status)) {
                        const provider = job.upscale.provider || (job.upscale.endpoint.startsWith('fal-ai/') ? 'fal' : 'replicate');
                        jobs.set(`${provider}:${job.upscale.providerJobId}`, { ...job, provider, providerJobId: job.upscale.providerJobId, endpoint: job.upscale.endpoint });
                    }
                }
            }
            // Complete every cleanup attempt before committing, or reporting a
            // failure. Retained DB receipts make partial storage cleanup retryable.
            const cancellations = await Promise.allSettled([...jobs.values()].map(job => cancelSpatialVideo(job).catch(error => {
                if ([404, 409].includes(Number(error?.status || error?.response?.status))) return;
                throw error;
            })));
            const cancelFailure = cancellations.find(result => result.status === 'rejected');
            if (cancelFailure?.status === 'rejected') throw cancelFailure.reason;
            const candidates = [...new Set([...collectPostDeletionMedia(posts[0], drafts, postMediaStorageUrl), ...creation.urls])];
            // A source can use library/reference assets also retained by another draft.
            const own = new Set(creation.urls);
            const urls: string[] = [];
            for (const url of candidates) {
                const canonical = postMediaStorageUrl(url);
                if (canonical && (own.has(canonical) || !await isCreationAssetRetained(canonical, query)) && !await isCreationLibraryAsset(canonical, query)) urls.push(canonical);
            }
            // S3 DeleteObject is idempotent for missing objects, including audio.
            const cleanup = await Promise.allSettled(urls.map(url => deleteCloudImageUrl(url, { retainedAssetAuthorized: true })));
            const failure = cleanup.find(result => result.status === 'rejected');
            if (failure?.status === 'rejected') throw failure.reason;
            await creation.finish();
            await optionalTable(query, 'DELETE FROM spatial_world_drafts WHERE post_id=?', [postId]);
            await optionalTable(query, 'DELETE FROM post_search WHERE post_id=?', [postId]);
            await optionalTable(query, 'DELETE FROM emotions WHERE post=?', [postId]);
            await optionalTable(query, 'DELETE FROM comments WHERE post=?', [postId]);
            const result = await query('DELETE FROM posts WHERE id=? AND sender=?', [postId, userId]);
            if (result.affectedRows !== 1) throw new Error('The post changed during deletion.');
            return true;
        });
        if (!deleted) { res.status(404).json({ error: 'Post not found or not owned by you.' }); return; }
        pushSocialChange('post', { id: postId });
        pushSocialChange('feeds');
        res.json({ message: 'Post deleted.', postId });
    } catch {
        // Provider/storage errors can retain authorization headers. Do not log
        // the raw error object or expose it in the response.
        console.error('Post deletion could not finish.');
        res.status(500).json({ error: 'Deletion did not finish. Try again.' });
    }
}
