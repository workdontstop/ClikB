import { useEffect, useRef } from 'react';

type Snapshot = {
  route: string; routeKey: string; tier?: string; historyPostId?: number; profileId?: number;
  fullscreen: boolean; postId?: number; index: number; scene: number; count: number; mode: unknown;
  expectedSource: string; mappedSource: unknown; coverSource: unknown; coverHidden: boolean; playing: boolean;
  captionHidden: boolean; relationshipsOpen: boolean;
};
type Entry = { time: string; event: string; details: Record<string, unknown> };
const entries: Entry[] = [];
const nodeIds = new WeakMap<Element, number>();
let nextNodeId = 0;

// Keep asset identity, without signed queries, data payloads or blob tokens.
function sourceLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === 'blob:' || url.protocol === 'data:') return `${url.protocol}local`;
    return (url.origin + url.pathname).slice(0, 240);
  } catch { return 'invalid-source'; }
}
function record(event: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  // Diagnostics must never interrupt playback, including a failed console write.
  try {
    const entry = { time: new Date().toISOString(), event, details };
    entries.push(entry);
    if (entries.length > 300) entries.shift();
    console.info('[FullscreenPlayback] ' + JSON.stringify(entry));
  } catch { /* Observation only. */ }
}

/** Read-only dev instrumentation. No state dispatch, media calls, polling or persistence. */
export function useFullscreenPlaybackDiagnostics(snapshot: Snapshot, scope?: { current: HTMLElement | null }) {
  const context = import.meta.env.DEV ? {
    ...snapshot, expectedSource: sourceLabel(snapshot.expectedSource), mappedSource: sourceLabel(snapshot.mappedSource), coverSource: sourceLabel(snapshot.coverSource),
  } : null;
  const latest = useRef(context);
  latest.current = context;
  const identity = import.meta.env.DEV ? JSON.stringify(context) : '';
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__fullscreenPlaybackDiagnostics = {
      entries: () => JSON.parse(JSON.stringify(entries)),
      export: () => entries.map(entry => '[FullscreenPlayback] ' + JSON.stringify(entry)).join('\n'),
    };
    record('viewer-mounted', latest.current!);
    const root = scope?.current ?? document.querySelector('[data-fullscreen-stories]');
    if (!root) return;
    const mediaDetails = (node: HTMLMediaElement) => {
      if (!nodeIds.has(node)) nodeIds.set(node, ++nextNodeId);
      const declared = node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '';
      let sourceMatchesDeclared: boolean | null = null;
      try { if (node.currentSrc && declared) sourceMatchesDeclared = node.currentSrc === new URL(declared, location.href).href; } catch { /* Invalid address is recorded below. */ }
      return {
        ...latest.current, node: nodeIds.get(node), mediaKind: node.tagName.toLowerCase(),
        mediaPostId: node.closest('[data-playback-post-id]')?.getAttribute('data-playback-post-id'),
        declared: sourceLabel(declared), actual: sourceLabel(node.currentSrc), sourceMatchesDeclared,
        poster: sourceLabel(node.getAttribute('poster')), time: Math.round(node.currentTime * 100) / 100,
        ready: node.readyState, network: node.networkState, paused: node.paused, muted: node.muted,
        connected: node.isConnected, display: node.style.display, opacity: node.style.opacity,
        error: node.error?.code ?? null,
      };
    };
    const onMedia = (event: Event) => {
      const node = event.target;
      if (!(node instanceof HTMLMediaElement) || !node.closest('[data-fullscreen-stories]')) return;
      record(event.type, mediaDetails(node));
    };
    const events = ['loadstart', 'emptied', 'loadeddata', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'error', 'seeking', 'seeked'];
    // Each viewer observes its own media; retained viewers/HMR must not label
    // another instance's video with their previous post or route context.
    events.forEach(name => root.addEventListener(name, onMedia, true));
    // Attribute observations explain source/cover swaps without changing the DOM.
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        const node = change.target;
        if (!(node instanceof Element) || !node.closest('[data-fullscreen-stories]')) continue;
        if (node instanceof HTMLMediaElement) record('media-' + change.attributeName, mediaDetails(node));
        else if (node.tagName === 'IMG' && change.attributeName === 'src') record('image-src', {
          ...latest.current, mediaPostId: node.closest('[data-playback-post-id]')?.getAttribute('data-playback-post-id'),
          source: sourceLabel(node.getAttribute('src')),
        });
      }
    });
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['src', 'poster', 'style'] });
    return () => {
      events.forEach(name => root.removeEventListener(name, onMedia, true));
      observer.disconnect();
      record('viewer-unmounted', latest.current!);
    };
  }, [snapshot.fullscreen, snapshot.count === 0]);
  useEffect(() => {
    if (import.meta.env.DEV) record('viewer-state', latest.current!);
  }, [identity]);
}
