import type { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import execQuery from './execQuery';
import { authenticatedUserId } from './requestAuth';
import { FISH_VOICES, fishVoice, type FishVoice } from './fishVoiceCatalog';
import { streamFishSpeech, FishSpeechError } from './FishSpeech';
import { recordFishSpeechUsage } from './FishUsage';
import { FISH_VOICE_PREVIEW_SCHEMA } from './fishVoicePreviewsSchema';

let schema: Promise<unknown> | undefined;
export const ensureFishVoiceSchema = () => schema ||= execQuery(FISH_VOICE_PREVIEW_SCHEMA).catch(error => { schema = undefined; throw error; });
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };

export function fishPreviewDeveloper(req: Request): string {
  if (process.env.APP_STATE !== 'dev') return fail('Developer preview tools are unavailable.', 403);
  const user = authenticatedUserId(req);
  if (!user) return fail('Sign in before using developer preview tools.', 401);
  const address = req.socket?.remoteAddress || '';
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
  const allowed = (process.env.FISH_PREVIEW_DEV_USER_IDS || '').split(',').map(x => x.trim()).includes(user);
  if (!local && !allowed) return fail('This developer is not allowed to generate previews.', 403);
  const origin = req.get('origin');
  if (origin) {
    let hostname = '';
    try { hostname = new URL(origin).hostname; } catch { return fail('Invalid developer origin.', 403); }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) && origin !== process.env.FISH_PREVIEW_DEV_ORIGIN) {
      return fail('This preview origin is not allowed.', 403);
    }
  }
  return user;
}

function storage() {
  const bucket = process.env.BUCKET_NAME, region = process.env.BUCKET_REGION;
  if (!bucket || !region || !process.env.BUCKET_ACCESS_KEY || !process.env.BUCKET_SECRET_KEY) fail('Voice preview storage is not configured.', 503);
  const client = new S3Client({ region, credentials: { accessKeyId: process.env.BUCKET_ACCESS_KEY!, secretAccessKey: process.env.BUCKET_SECRET_KEY! } });
  return { bucket: bucket!, region: region!, client };
}

type Draft = { id: string; user: string; voice: FishVoice; text: string; direction: string; createdAt: number; audio: Buffer; saving?: Promise<any> };
const drafts = new Map<string, Draft>();
const generating = new Map<string, Promise<Draft>>();
const expiresMs = 15 * 60_000;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
const cleanup = () => { for (const [id, draft] of drafts) if (!draft.saving && Date.now() - draft.createdAt > expiresMs) drafts.delete(id); };

/** Only catalogue identity and saved playback metadata; no remote catalogue call. */
export async function fishVoiceListRoute(_req: Request, res: Response): Promise<any> {
  let saved: any[] = [], storageAvailable = true;
  try { await ensureFishVoiceSchema(); saved = await execQuery(`SELECT p.id,p.voice_id,p.s3_key,p.s3_url,p.mime_type,p.created_at FROM fish_voice_previews p
    WHERE NOT EXISTS (SELECT 1 FROM fish_voice_previews n WHERE n.voice_id=p.voice_id
      AND (n.created_at>p.created_at OR (n.created_at=p.created_at AND n.id>p.id)))`); }
  catch { storageAvailable = false; }
  const latest = new Map<string, any>();
  for (const row of saved) if (!latest.has(row.voice_id)) latest.set(row.voice_id, row);
  const items = await Promise.all(FISH_VOICES.map(async voice => {
    const row = latest.get(voice.id);
    let previewUrl = voice.previewUrl;
    if (row) {
      try { const s = storage(); previewUrl = await getSignedUrl(s.client, new GetObjectCommand({ Bucket: s.bucket, Key: row.s3_key }), { expiresIn: 3600 }); }
      catch { /* Existing provider sample remains usable without S3 access. */ }
    }
    return { ...voice, previewUrl, savedPreview: Boolean(row), ...(row ? { previewRecordId: row.id, s3Url: row.s3_url } : {}) };
  }));
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ voices: items, previewStorageAvailable: storageAvailable });
}

export async function generateFishPreviewRoute(req: Request, res: Response): Promise<any> {
  try {
    const user = fishPreviewDeveloper(req); cleanup();
    const voice = fishVoice(req.body?.voiceId);
    if (!voice) fail('Choose a curated Fish voice.');
    const id = req.body?.requestId;
    if (!validId(id)) fail('A preview request ID is required.');
    const text = String(req.body?.text || '').trim(), direction = String(req.body?.direction || '').trim();
    if (!text || text.length > 1200 || direction.length > 500) fail('Use 1–1200 text characters and at most 500 direction characters.');
    const existing = drafts.get(id);
    if (existing && (existing.user !== user || existing.voice.id !== voice!.id || existing.text !== text || existing.direction !== direction)) fail('This request ID belongs to another preview.', 409);
    let work = generating.get(id);
    if (!work) {
      if (drafts.size >= 20 && !existing || generating.size >= 3) fail('Finish or close existing preview drafts first.', 429);
      work = existing ? Promise.resolve(existing) : (async () => {
        const audio: Buffer[] = [];
        let stats;
        try { stats = await streamFishSpeech({ voiceId: voice!.id, text, direction, format: 'mp3', totalTimeoutMs: 45000 }, data => { audio.push(data); }); }
        catch (error) {
          if (error instanceof FishSpeechError) recordFishSpeechUsage(error.stats, voice!.id, 'developer_preview');
          throw error;
        }
        recordFishSpeechUsage(stats, voice!.id, 'developer_preview');
        const draft: Draft = { id, user, voice: voice!, text, direction, createdAt: Date.now(), audio: Buffer.concat(audio) };
        drafts.set(id, draft); return draft;
      })();
      generating.set(id, work);
      void work.finally(() => generating.delete(id)).catch(() => {});
    }
    const draft = await work;
    // A concurrent caller must not receive another developer's accepted result.
    if (draft.user !== user || draft.voice.id !== voice!.id || draft.text !== text || draft.direction !== direction) fail('Preview request conflicts with an existing request.', 409);
    return res.json({ draftId: draft.id, audioContent: draft.audio.toString('base64'), mimeType: 'audio/mpeg', expiresAt: draft.createdAt + expiresMs });
  } catch (error: any) { return res.status(error?.status || 502).json({ message: error?.status ? error.message : 'Fish preview generation failed. No Gemini sample was saved.' }); }
}

export async function saveFishPreviewRoute(req: Request, res: Response): Promise<any> {
  try {
    const user = fishPreviewDeveloper(req), id = req.body?.draftId;
    if (!validId(id)) fail('Choose a generated preview.');
    await ensureFishVoiceSchema();
    const saved = await execQuery('SELECT id,s3_url FROM fish_voice_previews WHERE request_id=? AND created_by=?', [id, user]);
    if (saved[0]) return res.json({ id: saved[0].id, s3Url: saved[0].s3_url, alreadySaved: true });
    cleanup(); const draft = drafts.get(id);
    if (!draft || draft.user !== user) fail('This preview draft expired. Generate a new preview explicitly.', 409);
    if (!draft!.saving) draft!.saving = (async () => {
      const s = storage(), key = `fish-voice-previews/${draft!.voice.referenceId}/${id}.mp3`;
      await s.client.send(new PutObjectCommand({ Bucket: s.bucket, Key: key, Body: draft!.audio,
        ContentType: 'audio/mpeg', CacheControl: 'private, max-age=3600' }));
      const s3Url = `https://${s.bucket}.s3.${s.region}.amazonaws.com/${key}`, rowId = randomUUID();
      await execQuery(`INSERT INTO fish_voice_previews (id,request_id,voice_id,reference_id,model,display_name,preview_text,direction,content_hash,s3_key,s3_url,mime_type,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`,
      [rowId,id,draft!.voice.id,draft!.voice.referenceId,'s2.1-pro',draft!.voice.name,draft!.text,draft!.direction,
        createHash('sha256').update(draft!.audio).digest('hex'),key,s3Url,'audio/mpeg',user]);
      const rows = await execQuery('SELECT id,s3_url FROM fish_voice_previews WHERE request_id=? AND created_by=?', [id,user]);
      return { id: rows[0].id, s3Url: rows[0].s3_url };
    })().catch(error => { draft!.saving = undefined; throw error; });
    return res.json(await draft!.saving);
  } catch (error: any) { return res.status(error?.status || 503).json({ message: error?.status ? error.message : 'Preview save failed. Your draft can be saved again without generating audio.' }); }
}
