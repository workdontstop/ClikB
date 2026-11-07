/** Only the Deck's own preview node is managed here; Redux audio preferences stay unchanged. */
export type DeckPreviewMedia = {
  muted: boolean; volume: number; loop: boolean; isConnected: boolean; paused: boolean;
  play: () => Promise<void> | void; pause: () => void; load: () => void;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void; removeAttribute: (name: string) => void;
  addEventListener: (name: string, listener: EventListener) => void;
  removeEventListener: (name: string, listener: EventListener) => void;
};
export type DeckPreviewLifecycle = {
  media: DeckPreviewMedia;
  start: () => void;
  pause: () => void;
  dispose: () => void;
  isActive: () => boolean;
};
type OwnedLifecycle = DeckPreviewLifecycle & { detachListeners: () => void };
const owners = new WeakMap<DeckPreviewMedia, OwnedLifecycle>();

/** Synchronous silence precedes route transitions and React's passive cleanup. */
export const releaseDeckPreviewMedia = (media: DeckPreviewMedia): void => {
  try { media.muted = true; } catch { /* Keep releasing even if a detached decoder rejects a property write. */ }
  try { media.volume = 0; } catch { /* No global volume preference is changed. */ }
  try { media.pause(); } catch { /* A pause failure must not retain the source. */ }
  try { media.removeAttribute('src'); } catch { /* Continue clearing the decoder. */ }
  try { media.load(); } catch { /* Detached nodes can reject decoder operations. */ }
};

export function createDeckPreviewLifecycle(media: DeckPreviewMedia, options: {
  source: string;
  playback: () => { muted: boolean; volume: number };
  isCurrent: () => boolean;
  isVisible: () => boolean;
  onPlaying: (playing: boolean) => void;
  onBlocked: (blocked: boolean) => void;
}): DeckPreviewLifecycle {
  const previous = owners.get(media);
  previous?.dispose();
  previous?.detachListeners();
  let disposed = false;
  const isActive = () => !disposed && owners.get(media) === lifecycle
    && media.isConnected && options.isCurrent() && options.isVisible();
  const silenceIfInactive = () => {
    // React Strict Mode may have reused this same node for a newer active lease.
    if (owners.get(media) !== lifecycle) return;
    if (disposed || !media.isConnected || !options.isCurrent()) releaseDeckPreviewMedia(media);
    else if (!options.isVisible()) {
      try { media.muted = true; media.volume = 0; media.pause(); } catch { /* The visible start restores preferences. */ }
    }
  };
  const playing: EventListener = () => {
    if (!isActive()) { silenceIfInactive(); return; }
    options.onBlocked(false);
    options.onPlaying(true);
  };
  const paused: EventListener = () => { if (!disposed && owners.get(media) === lifecycle && options.isCurrent()) options.onPlaying(false); };
  const lifecycle: OwnedLifecycle = {
    media, isActive,
    start: () => {
      if (!isActive()) { silenceIfInactive(); return; }
      const playback = options.playback();
      media.muted = playback.muted;
      media.volume = playback.volume;
      media.loop = true;
      if (media.getAttribute('src') !== options.source) media.setAttribute('src', options.source);
      try {
        Promise.resolve(media.play()).then(() => {
          if (!isActive()) { silenceIfInactive(); return; }
          options.onBlocked(false);
          options.onPlaying(!media.paused);
        }).catch(() => {
          if (!isActive()) { silenceIfInactive(); return; }
          options.onBlocked(true);
          options.onPlaying(false);
        });
      } catch {
        if (isActive()) { options.onBlocked(true); options.onPlaying(false); }
        else silenceIfInactive();
      }
    },
    pause: () => { if (owners.get(media) === lifecycle) { try { media.pause(); } catch { /* Hidden previews never retry playback here. */ } } },
    dispose: () => {
      if (disposed) { silenceIfInactive(); return; }
      disposed = true;
      media.removeEventListener('pause', paused);
      // Keep the owned node's playing guard until a newer lease replaces it or
      // the detached node is collected. Late browser playback cannot revive audio.
      silenceIfInactive();
    },
    detachListeners: () => { media.removeEventListener('playing', playing); media.removeEventListener('pause', paused); },
  };
  owners.set(media, lifecycle);
  media.addEventListener('playing', playing);
  media.addEventListener('pause', paused);
  return lifecycle;
}
