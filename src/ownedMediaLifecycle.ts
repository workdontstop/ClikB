export type OwnedMediaNode = Pick<HTMLMediaElement, 'isConnected' | 'muted' | 'volume' | 'src' | 'onended' | 'play' | 'pause' | 'load' | 'removeAttribute' | 'addEventListener' | 'removeEventListener'>;
export type OwnedMediaPlayback = { play: () => Promise<void>; dispose: (release?: boolean) => void; isActive: () => boolean };
type PlaybackOwner = OwnedMediaPlayback & { detach: () => void };
const owners = new WeakMap<OwnedMediaNode, PlaybackOwner>();
export const releaseOwnedMedia = (media: OwnedMediaNode): void => {
  try { media.muted = true; } catch { /* Release the decoder even if a property write fails. */ }
  try { media.volume = 0; } catch { /* Redux preference is untouched. */ }
  try { media.pause(); } catch { /* Continue releasing its source. */ }
  try { media.removeAttribute('src'); } catch { /* Continue releasing its decoder. */ }
  try { media.load(); } catch { /* A detached decoder can reject load. */ }
};

/** The retired node keeps a playing guard, without silencing a newer owner. */
export function createOwnedMediaPlayback(media: OwnedMediaNode, isCurrent: () => boolean, stopIfNotCurrent = true, retiredCanRelease = () => true): OwnedMediaPlayback {
  const previous = owners.get(media);
  previous?.dispose(); previous?.detach();
  let disposed = false;
  const isActive = () => !disposed && owners.get(media) === owner && media.isConnected && isCurrent();
  const guard = () => {
    if (owners.get(media) !== owner) return;
    if (disposed && !retiredCanRelease()) { owner.detach(); owners.delete(media); return; }
    if (disposed || !media.isConnected || (!isCurrent() && stopIfNotCurrent)) releaseOwnedMedia(media);
  };
  const playing: EventListener = () => { if (!isActive()) guard(); };
  const owner: PlaybackOwner = {
    isActive,
    play: async () => {
      if (!isActive()) { guard(); return; }
      try { await media.play(); } finally { if (!isActive()) guard(); }
    },
    dispose: (release = true) => {
      if (disposed) return;
      disposed = true;
      if (owners.get(media) !== owner) return;
      if (release) releaseOwnedMedia(media);
      else { owner.detach(); owners.delete(media); }
    },
    detach: () => media.removeEventListener('playing', playing),
  };
  owners.set(media, owner); media.addEventListener('playing', playing);
  return owner;
}

export type OwnedAudioChain = { play: (source: string) => Promise<void>; onEnded: (callback: () => void) => void; schedule: (callback: () => void, delay: number) => void; dispose: () => void; isActive: () => boolean };
/** Feed audio survives viewer unmount, so track identity and the owned ended handler as well. */
export function createOwnedAudioChain(media: OwnedMediaNode, clock = { setTimeout, clearTimeout }): OwnedAudioChain {
  let disposed = false, source: string | null = null;
  let ended: OwnedMediaNode['onended'] = null;
  let retiredSource: string | null = null;
  let retiredEnded: OwnedMediaNode['onended'] = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ownsSource = () => source != null && media.src === source && media.onended === ended;
  const playback = createOwnedMediaPlayback(media, () => !disposed && ownsSource(), false,
    () => retiredSource == null || (media.src === retiredSource && media.onended === retiredEnded));
  return {
    isActive: () => !disposed && playback.isActive(),
    play: async value => {
      if (disposed || media.onended !== ended || (source != null && media.src !== source)) return;
      media.src = value; source = media.src;
      await playback.play();
    },
    onEnded: callback => { ended = () => { if (!disposed && playback.isActive()) callback(); }; media.onended = ended; },
    schedule: (callback, delay) => {
      const timer = clock.setTimeout(() => { timers.delete(timer); if (!disposed && playback.isActive()) callback(); }, delay);
      timers.add(timer);
    },
    dispose: () => {
      if (disposed) return;
      const release = ownsSource();
      disposed = true; timers.forEach(timer => clock.clearTimeout(timer)); timers.clear();
      if (media.onended === ended) media.onended = null;
      playback.dispose(release);
      retiredSource = media.src; retiredEnded = media.onended;
    },
  };
}

export type OwnedNarrationSession = {
  begin: () => number; stop: () => number; currentToken: () => number | null;
  isCurrent: (token: number) => boolean; sameGeneration: (token: number) => boolean;
  attach: (utterance: Pick<SpeechSynthesisUtterance, 'onend' | 'onerror'>, token: number) => void;
  schedule: (token: number, callback: () => void, delay: number) => void;
};
/** Invalidating a viewer's session detaches only its own callbacks, never global speech. */
export function createOwnedNarrationSession(clock = { setTimeout, clearTimeout }): OwnedNarrationSession {
  let generation = 0, active = false;
  let utterance: Pick<SpeechSynthesisUtterance, 'onend' | 'onerror'> | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const stop = () => {
    active = false; generation++;
    timers.forEach(timer => clock.clearTimeout(timer)); timers.clear();
    if (utterance) { utterance.onend = null; utterance.onerror = null; utterance = null; }
    return generation;
  };
  const isCurrent = (token: number) => active && generation === token;
  return {
    begin: () => { stop(); active = true; return generation; }, stop,
    currentToken: () => active ? generation : null, isCurrent, sameGeneration: token => generation === token,
    attach: (next, token) => { if (isCurrent(token)) { if (utterance && utterance !== next) { utterance.onend = null; utterance.onerror = null; } utterance = next; } },
    schedule: (token, callback, delay) => {
      if (!isCurrent(token)) return;
      const timer = clock.setTimeout(() => { timers.delete(timer); if (isCurrent(token)) callback(); }, delay);
      timers.add(timer);
    },
  };
}
