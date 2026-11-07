/** Match the saved post contract: published composite first, then the single scene.
 * Never infer publication, or mine an unfinished creation draft for media. */
export function postVideoSource(post: Record<string, any> | undefined, published?: unknown): string {
  if (!post || Number(post.mode) === 2) return '';
  const media = [published, post.videoUrl, post.xv1, post.nobgmvideo, post.video]
    .find((value): value is string => typeof value === 'string'
      && !['','null','undefined'].includes(value.trim().toLowerCase())
      && !/^\d+(?:\.\d+)?$/.test(value.trim())); // `video` can be the DB status flag (1/100).
  if (media) return media.trim();
  // `main` also stores game code; only accept an actual media address here.
  return typeof post.main === 'string' && /^(https?:\/\/|blob:|data:video\/|\/)|\.(mp4|webm|mov)(\?|$)/i.test(post.main.trim()) ? post.main.trim() : '';
}
