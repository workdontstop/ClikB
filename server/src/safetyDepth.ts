// Provider schema: https://replicate.com/chenxwh/depth-any-video
export const SAFETY_DEPTH_MODEL = 'chenxwh/depth-any-video:4055afe2aba32ab3d2dbccc4fabb240bf643db7fe56f33c1f9535d948b219495' as const;

export function safetyDepthInput(value: unknown) {
  if (typeof value !== 'string' || value.length > 16_000) throw new Error('Add an HTTPS reference video URL.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Add an HTTPS reference video URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname === '/') throw new Error('Add an HTTPS reference video URL.');
  return { input_image_or_video: value.trim(), input_is_video: true };
}

export function resolveSafetyDepthOutput(output: unknown): string {
  for (const candidate of Array.isArray(output) ? output : [output]) {
    let value: unknown = candidate;
    if (value && typeof value === 'object') {
      const item = value as Record<string, any>;
      value = typeof item.url === 'function' ? String(item.url()) : item.url || item.depth_video || item.video;
    }
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) return value;
    } catch { /* Try the next provider output. */ }
  }
  throw new Error('The depth model did not return a usable video URL.');
}
