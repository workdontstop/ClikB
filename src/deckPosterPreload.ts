type PosterEntry = { image: HTMLImageElement };
const posters = new Map<string, PosterEntry>();
const LIMIT = 48;

/** Warm only nearby posters once per URL. Browser cache still owns the bytes. */
export function preloadDeckPoster(url: string): void {
  if (!url || typeof Image === 'undefined') return;
  const cached = posters.get(url);
  if (cached) { posters.delete(url); posters.set(url, cached); return; }
  const image = new Image(), entry = { image };
  posters.set(url, entry);
  image.decoding = 'async';
  image.onload = () => { image.onload = null; image.onerror = null; };
  image.onerror = () => { if (posters.get(url) === entry) posters.delete(url); image.onload = null; image.onerror = null; };
  image.src = url;
  // Decode is advisory; failure must not hold up the visible cards or navigation.
  image.decode?.().catch(() => {});
  if (posters.size > LIMIT) {
    const oldest = posters.keys().next().value;
    if (oldest) posters.delete(oldest);
  }
}
