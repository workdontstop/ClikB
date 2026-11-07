type Context = Record<string, any>;
type Target = { promptKey: string; scene: number; bIndex?: number };

const bindingKey = (item: any) => `${Number(item?.scene) || 0}:${Number(item?.bIndex) || 0}:${String(item?.url || '')}`;
const sameSlot = (item: any, target: Target) => item?.scene === target.scene && (item?.bIndex || undefined) === target.bIndex;

/** Images may refresh the image-owned context without erasing saved video provenance. */
export function mergeSavedVideoPlanMedia(previous: Context, incoming: Context): Context {
  const merge = (field: string) => {
    const seen = new Set<string>();
    return [...(Array.isArray(previous[field]) ? previous[field] : []), ...(Array.isArray(incoming[field]) ? incoming[field] : [])]
      .filter(item => {
        const key = bindingKey(item);
        if (!item?.url || seen.has(key)) return false;
        seen.add(key); return true;
      });
  };
  return { ...incoming, referenceVideos: merge('referenceVideos'), motionVideos: merge('motionVideos'), safetyMedia: merge('safetyMedia'),
    safetyAudioUrls: [...new Set([...(Array.isArray(previous.safetyAudioUrls) ? previous.safetyAudioUrls : []), ...(Array.isArray(incoming.safetyAudioUrls) ? incoming.safetyAudioUrls : [])].filter(url => typeof url === 'string'))],
    videoPrompts: { ...(incoming.videoPrompts || {}), ...(previous.videoPrompts || {}) } };
}

/** A URL can be used by several scene slots; retain every binding separately. */
export function recordSceneVideoPlanMedia(context: Context, values: Context, target: Target): void {
  // A video save can happen after the last image save; its conditioning assets
  // must have durable deletion receipts before temporary cleanup is cancelled.
  if (Array.isArray(values.safetyMedia)) {
    const retained = Array.isArray(context.safetyMedia) ? context.safetyMedia : [];
    for (const entry of values.safetyMedia) {
      if (!entry || typeof entry.url !== 'string' || !/^https?:\/\//.test(entry.url.trim()) || !['image','video'].includes(entry.kind)) continue;
      const item = { url: entry.url.trim(), kind: entry.kind, role: 'safety-media', scene: target.scene,
        ...(target.bIndex ? { bIndex: target.bIndex } : {}), ...(typeof entry.label === 'string' ? { label: entry.label.slice(0,200) } : {}), deleteOnPostDelete: true };
      if (!retained.some((saved: any) => bindingKey(saved) === bindingKey(item))) retained.push(item);
    }
    context.safetyMedia = retained;
  }
  if (Array.isArray(values.safetyAudioUrls)) {
    context.safetyAudioUrls = [...new Set([...(Array.isArray(context.safetyAudioUrls) ? context.safetyAudioUrls : []),
      ...values.safetyAudioUrls.filter((url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url.trim())).map((url: string) => url.trim())])];
  }
  if (typeof values.videoPrompt === 'string' && values.videoPrompt.trim()) {
    context.videoPrompts = { ...(context.videoPrompts || {}), [target.promptKey]: values.videoPrompt.trim() };
  }
  for (const [field, valueField, role, title] of [
    ['referenceVideos','usedReferenceVideoUrl','reference-video','Video Ref'],
    ['motionVideos','usedMotionVideoUrl','motion-video','3D Motion Ref'],
  ]) {
    // Older saves and upscale-only requests carry no usage snapshot.
    if (values.referenceUsageCaptured !== true && typeof values[valueField] !== 'string') continue;
    const raw = typeof values[valueField] === 'string' ? values[valueField].trim() : '';
    if (raw && !/^https?:\/\//.test(raw)) throw new Error('Invalid saved video reference URL.');
    const items = Array.isArray(context[field]) ? context[field] : [];
    const previous = items.filter((item: any) => sameSlot(item, target));
    const retained = Array.isArray(context.retainedMedia) ? context.retainedMedia : [];
    for (const item of previous) if (item.url && item.url !== raw && !retained.some((saved: any) => saved.url === item.url)) {
      retained.push({ ...item, role: 'previous-video-reference', deleteOnPostDelete: item.deleteOnPostDelete !== false });
    }
    context.retainedMedia = retained;
    context[field] = items.filter((item: any) => !sameSlot(item, target));
    if (raw) context[field].push({ url: raw, kind: 'video', role,
      label: target.bIndex ? `B-shot ${target.scene}.${target.bIndex} ${title}` : `Scene ${target.scene} ${title}`,
      scene: target.scene, ...(target.bIndex ? { bIndex: target.bIndex } : {}),
      ...(typeof values.videoPrompt === 'string' ? { prompt: values.videoPrompt.trim() } : {}), deleteOnPostDelete: true });
  }
}
