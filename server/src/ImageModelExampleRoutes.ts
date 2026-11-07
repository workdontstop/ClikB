import type { Request, Response, NextFunction } from 'express';
import execQuery, { withTransaction } from './execQuery';
import { requireAuthenticatedRequest } from './requestAuth';
import { deleteCloudImageUrl, postMediaStorageUrl } from './S3Routes';
import { normalizeModelExampleImages, type ImageModelExampleSet } from './imageModelExamples';

export function requireExampleDeveloper(req: Request, res: Response, next: NextFunction): void {
  if (process.env.APP_STATE !== 'dev') { res.status(404).json({ message: 'Route not found.' }); return; }
  requireAuthenticatedRequest(req, res, next);
}

export async function listImageModelExampleSets(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await execQuery('SELECT id, name, model_images, created_at FROM image_model_example_sets ORDER BY id DESC');
    const sets: ImageModelExampleSet[] = rows.map((row: any) => ({
      id: String(row.id), name: row.name, model_images: normalizeModelExampleImages(row.model_images), created_at: row.created_at,
    }));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ sets });
  } catch (error) {
    console.error('Could not load image model example sets:', error);
    res.status(500).json({ message: 'Could not load image model examples.' });
  }
}

export async function saveImageModelExampleSet(req: Request, res: Response): Promise<void> {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const raw = req.body?.model_images;
  const images = normalizeModelExampleImages(raw);
  if (!name || name.length > 160 || !raw || Array.isArray(raw) || typeof raw !== 'object'
    || !Object.keys(images).length || Object.keys(images).length !== Object.keys(raw).length) {
    res.status(400).json({ message: 'Provide a set name and at least one image for a supported model.' }); return;
  }
  try {
    // Reuse the existing app-owned files. Never copy or regenerate examples.
    if (Object.values(images).some(url => !postMediaStorageUrl(url))) {
      res.status(400).json({ message: 'Save the images to ClikB storage before adding the set.' }); return;
    }
    const result = await execQuery('INSERT INTO image_model_example_sets (name, model_images) VALUES (?, ?)', [name, JSON.stringify(images)]);
    res.status(201).json({ id: String(result.insertId) });
  } catch (error) {
    console.error('Could not save image model example set:', error);
    res.status(500).json({ message: 'Could not save the image model example set.' });
  }
}

export async function deleteImageModelExampleSet(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '');
  if (!/^[1-9]\d*$/.test(id)) { res.status(400).json({ message: 'Invalid set ID.' }); return; }
  try {
    const deleted = await withTransaction(async query => {
      // Serialize set deletion and keep the DB row on storage failure for retry.
      const rows = await query('SELECT id, model_images FROM image_model_example_sets ORDER BY id FOR UPDATE');
      const selected = rows.find((row: any) => String(row.id) === id);
      if (!selected) return false;
      const images = normalizeModelExampleImages(selected.model_images);
      const keys = [...new Set(Object.values(images).map(url => postMediaStorageUrl(url)))];
      if (keys.some(key => !key)) throw new Error('The set contains an image outside ClikB storage.');
      // A URL can be reused in another set; retain it until its final set is removed.
      const others = rows.filter((row: any) => String(row.id) !== id);
      const shared = new Set<string>();
      for (const row of others) for (const url of Object.values(normalizeModelExampleImages(row.model_images))) {
        const key = postMediaStorageUrl(url); if (key) shared.add(key);
      }
      for (const key of keys) if (key && !shared.has(key)) await deleteCloudImageUrl(key);
      await query('DELETE FROM image_model_example_sets WHERE id = ?', [id]);
      return true;
    });
    res.status(deleted ? 200 : 404).json({ message: deleted ? 'Set deleted.' : 'Set not found.' });
  } catch (error) {
    console.error('Could not delete image model example set:', error);
    res.status(500).json({ message: 'Could not finish deleting the set. It is still listed so you can retry.' });
  }
}
