import type { TransactionQuery } from '../execQuery';
import { appendVideoHistory, mergeVideoHistory, normalizeVideoHistory, parseVideoHistoryContext } from '../videoHistory';
import { normalizeImageModels } from '../imageModelExamples';
import { mergeSavedVideoPlanMedia, recordSceneVideoPlanMedia } from '../planVideoMedia';

function slot(index: unknown, mode: unknown, prefix: string) {
  const value = Number(index), cinema = Number(mode) === 1;
  if (!Number.isInteger(value) || value < 0 || value >= (cinema ? 18 : 9)) throw new Error('Invalid scene target.');
  return { col: `${prefix}${cinema ? Math.floor(value / 2) + 1 : value + 1}${cinema && value % 2 ? 'B' : ''}`, scene: cinema ? Math.floor(value / 2) + 1 : value + 1,
    stageB: cinema && value % 2 === 1, native: value };
}

/** The same column/history ownership rules as existing normal creation saves. */
export async function applyQuietProjection(query: TransactionQuery, postId: number, projection: any): Promise<Record<string, any>> {
  if (!projection) return {};
  const values = projection.values || {}, kind = projection.kind;
  if (values.postId != null && Number(values.postId) !== postId) throw new Error('Projection post identity does not match the draft.');
  const rows = await query('SELECT * FROM posts WHERE id=? FOR UPDATE', [postId]);
  const post = rows[0]; if (!post) throw new Error('Draft post was removed.');
  const context = parseVideoHistoryContext(post.kontext);
  if (kind === 'topology') {
    const snapshot = values.snapshot;
    const input = snapshot?.sections?.prompt || {}, studio = snapshot?.sections?.storybook || {};
    const cinema = snapshot?.creationType === 1, count = cinema ? 18 : 9;
    const columns: string[] = [], parameters: unknown[] = [];
    const set = (key: string, value: unknown) => { columns.push(`${key}=?`); parameters.push(value ?? null); };
    for (let index = 0; index < count; index++) {
      const target = slot(index, cinema ? 1 : 0, 'x');
      const suffix = target.col.slice(1);
      set(`x${suffix}`, input.generatedImagesFluxx?.[index]);
      set(`xh${suffix}`, input.ImagesHdCloud?.[index]);
      set(`xt${suffix}`, input.parsedKeyPoints?.[index]);
      set(`gent${suffix}`, studio.GeneratedText?.[index]);
      set(`xv${suffix}`, studio.VideoArrayCloud?.[index]);
      const audioIndex = cinema ? Math.floor(index / 2) : index;
      set(`xa${suffix}`, input.generatedAudios?.[audioIndex]);
    }
    if (!cinema) for (let scene = 1; scene <= 9; scene++) for (const prefix of ['x','xh','xt','gent','xv','xa']) set(`${prefix}${scene}B`, null);
    set('bshot', JSON.stringify({ imagesarray: input.bShotImages || [], videoarray: input.bShotVideos || [], promptsarray: input.bShotPrompts || [] }));
    if (studio.intentBlueprintState) set('intent_blueprint_json', JSON.stringify(studio.intentBlueprintState));
    context.videoHistory = normalizeVideoHistory(studio.videoHistory);
    set('kontext', JSON.stringify(context));
    await query(`UPDATE posts SET ${columns.join(',')} WHERE id=?`, [...parameters, postId]);
    return {};
  }
  if (kind === 'video') {
    const target = slot(values.type, values.mode, 'xv'), previous = post[target.col];
    if (typeof values.vid !== 'string' || !/^https?:\/\//.test(values.vid)) throw new Error('Stored video is required.');
    const key = `A:${target.native}`;
    context.videoHistory = mergeVideoHistory(context.videoHistory, values.videoHistory);
    for (const source of [values.upscale?.sourceUrl, previous]) if (typeof source === 'string') context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: source, createdAt: 0 });
    context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: values.vid,
      createdAt: Number(values.videoHistoryEntry?.createdAt) || Date.now(), prompt: values.videoHistoryEntry?.prompt });
    const retained = Array.isArray(context.retainedMedia) ? context.retainedMedia : [];
    for (const entries of Object.values(normalizeVideoHistory(context.videoHistory))) for (const entry of entries) {
      if (!retained.some((item: any) => item.url === entry.videoUrl)) retained.push({ url: entry.videoUrl, kind: 'video', role: 'video-history', deleteOnPostDelete: true });
    }
    context.retainedMedia = retained;
    recordSceneVideoPlanMedia(context, values, { promptKey: key, scene: target.scene, ...(target.stageB ? { bIndex: 1 } : {}) });
    let promoted = true;
    if (values.upscale) {
      const metadata = values.upscale, resolution = String(metadata.resolution || '').toLowerCase();
      if (!['1080p', '2k'].includes(resolution)) throw new Error('Invalid upscale resolution.');
      promoted = metadata.promote !== false && previous === metadata.sourceUrl;
      const history = Array.isArray(context.upscales?.[target.col]) ? context.upscales[target.col] : [];
      history.push({ videoUrl: values.vid, sourceUrl: String(metadata.sourceUrl || ''), resolution, fps: 60,
        predictionId: String(metadata.predictionId || ''), duration: Number(metadata.duration) || null, savedAt: new Date().toISOString() });
      context.upscales = { ...context.upscales, [target.col]: history };
    }
    await query(`UPDATE posts SET ${promoted ? `${target.col}=?,` : ''}kontext=? WHERE id=?`, [...(promoted ? [values.vid] : []), JSON.stringify(context), postId]);
    return { promoted, column: target.col, scene: target.scene, stage: target.stageB ? 2 : 1 };
  }
  if (kind === 'image-edit') {
    const target = slot(values.type, values.mode, 'xh');
    if (typeof values.img !== 'string' || !/^https?:\/\//.test(values.img)) throw new Error('Stored image is required.');
    if (typeof values.imageModel === 'string' && values.imageModel) context.imageModels = { ...normalizeImageModels(context.imageModels), [values.img]: values.imageModel.slice(0,100) };
    await query(`UPDATE posts SET ${target.col}=?,kontext=? WHERE id=?`, [values.img, JSON.stringify(context), postId]);
    return { promoted: true, column: target.col };
  }
  if (kind === 'broll') {
    if (typeof values.bshot !== 'string') throw new Error('B-roll truth is required.');
    const incoming = JSON.parse(values.bshot);
    if (!incoming || typeof incoming !== 'object') throw new Error('Invalid B-roll truth.');
    context.imageModels = { ...normalizeImageModels(context.imageModels), ...normalizeImageModels(values.imageModels) };
    context.videoHistory = mergeVideoHistory(context.videoHistory, values.videoHistory);
    let promoted = true, truth = incoming;
    if (values.upscale) {
      const metadata = values.upscale, scene = Number(metadata.parentScene), shot = Number(metadata.bShotIndex);
      const resolution = String(metadata.resolution || '').toLowerCase();
      if (!['1080p','2k'].includes(resolution) || !Number.isInteger(scene) || scene < 0 || !Number.isInteger(shot) || shot < 0) throw new Error('Invalid B-roll upscale.');
      try { truth = JSON.parse(post.bshot || '{}'); } catch { truth = {}; }
      promoted = metadata.promote !== false && truth.videoarray?.[scene]?.[shot] === metadata.sourceUrl;
      const key = `B:${scene}:${shot}`, history = Array.isArray(context.bshotUpscales?.[key]) ? context.bshotUpscales[key] : [];
      history.push({ videoUrl: metadata.videoUrl, sourceUrl: metadata.sourceUrl, resolution, fps: 60, duration: Number(metadata.duration) || null,
        predictionId: String(metadata.predictionId || ''), savedAt: new Date().toISOString() });
      context.bshotUpscales = { ...context.bshotUpscales, [key]: history };
      for (const url of [metadata.sourceUrl, metadata.videoUrl]) context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: url, createdAt: Date.now() });
      if (promoted) truth.videoarray[scene][shot] = metadata.videoUrl;
    }
    if (typeof values.targetKey === 'string' && /^B:\d+:\d+$/.test(values.targetKey)) {
      const [, scene, shot] = values.targetKey.split(':');
      recordSceneVideoPlanMedia(context, values, { promptKey: values.targetKey, scene: Number(scene) + 1, bIndex: Number(shot) + 1 });
    }
    await query('UPDATE posts SET bshot=?,kontext=? WHERE id=?', [JSON.stringify(truth), JSON.stringify(context), postId]);
    return { promoted };
  }
  if (kind === 'metadata') {
    const allowed = ['caption','thumb1','prompt'];
    const entries = Object.entries(values).filter(([key]) => allowed.includes(key));
    if (entries.length) await query(`UPDATE posts SET ${entries.map(([key]) => `${key}=?`).join(',')} WHERE id=?`, [...entries.map(([,value]) => value), postId]);
    return {};
  }
  throw new Error('Unsupported creation projection.');
}

export function mergeImageContext(previous: unknown, incoming: unknown): string | null {
  if (incoming == null) return null;
  try {
    const oldContext = parseVideoHistoryContext(previous), next = parseVideoHistoryContext(incoming);
    return JSON.stringify({ ...oldContext, ...mergeSavedVideoPlanMedia(oldContext, next), retainedMedia: oldContext.retainedMedia || [],
      upscales: oldContext.upscales || {}, bshotUpscales: oldContext.bshotUpscales || {},
      videoHistory: mergeVideoHistory(oldContext.videoHistory, next.videoHistory),
      imageModels: { ...normalizeImageModels(oldContext.imageModels), ...normalizeImageModels(next.imageModels) } });
  } catch { return typeof incoming === 'string' ? incoming : JSON.stringify(incoming); }
}
