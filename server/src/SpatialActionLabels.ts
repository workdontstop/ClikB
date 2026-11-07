import type { Request, Response } from 'express';
import { withTransaction } from './execQuery';
import { authenticatedUserId } from './requestAuth';
import { patchActionLabels, readActionLabels, readActionLabelRevision, validateActionLabelPatches, type SpatialActionLabelPatch } from './spatialLabelMetadata';

class LabelRequestError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function spatialActionLabels(req: Request, res: Response): Promise<any> {
    const userId = authenticatedUserId(req), postId = Number(req.method === 'GET' ? req.query.postId : req.body?.postId);
    if (!userId) return res.status(401).json({ message: 'Please sign in.' });
    if (!Number.isSafeInteger(postId) || postId <= 0) return res.status(400).json({ message: 'A saved post is required.' });
    let patches: SpatialActionLabelPatch[] | undefined;
    if (req.method !== 'GET') {
        try { patches = validateActionLabelPatches(req.body?.labels); }
        catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    }
    try {
        const labels = await withTransaction(async query => {
            const rows = await query('SELECT spatial_experience_json FROM posts WHERE id=? AND sender=? AND mode=2 FOR UPDATE', [postId, userId]);
            if (!rows.length) throw new LabelRequestError(404, 'Spatial post was not found.');
            const stored = rows[0].spatial_experience_json;
            const document = typeof stored === 'string' ? JSON.parse(stored) : stored || {};
            if (!patches) return { actionLabels: readActionLabels(document), actionLabelsRevision: readActionLabelRevision(document) };
            let updated;
            try { updated = patchActionLabels(document, patches, req.body?.preview === true); }
            catch (error) { throw new LabelRequestError(409, (error as Error).message); }
            const json = JSON.stringify(updated);
            if (Buffer.byteLength(json) > 4_000_000) throw new LabelRequestError(413, 'Spatial experience is too large.');
            await query('UPDATE posts SET spatial_experience_json=? WHERE id=? AND sender=? AND mode=2', [json, postId, userId]);
            return { actionLabels: readActionLabels(updated), actionLabelsRevision: readActionLabelRevision(updated) };
        });
        return res.json(labels);
    } catch (error) {
        if (error instanceof LabelRequestError) return res.status(error.status).json({ message: error.message });
        console.error('Spatial action labels could not be saved.');
        return res.status(500).json({ message: 'Labels could not be saved. Please try again.' });
    }
}
