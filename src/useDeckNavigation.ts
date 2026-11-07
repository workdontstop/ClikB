import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { registerSharedBack } from './SharedBackControl';
import { DECK_PAGE_SIZE, type DeckCategory } from './deckControlSnapshot';
import { isDeletedFeedPost } from './feedCollectionCache';

export type { DeckCategory } from './deckControlSnapshot';
type ScrollPoint = { x: number; y: number };
type DeckEntry = {
  sessionId: string;
  version: 1; tier: 'deck' | 'story'; activePostId: number | null;
  collectionIds: number[]; category: DeckCategory; scroll: ScrollPoint;
  collectionReady?: boolean;
  returnTo: { pathname: string; search: string; hash: string; state: any };
};
// Keep route re-entry collections by identity without serializing media into snapshots.
const collections = new Map<string, { feeds: Record<string, any>[]; scope?: string; hasMore?: boolean; fetchCount?: number; activePostId?: number | null }>();
const fullscreenFocus = new Map<string, { activePostId: number; collectionIds: number[] }>();
function rememberSession<T>(cache: Map<string, T>, key: string, value: T) {
  cache.delete(key);
  cache.set(key, value);
  // History still owns identities; this is only a bounded media-data warm cache.
  if (cache.size > 96) cache.delete(cache.keys().next().value!);
}
type CachedCollection = { feeds: Record<string, any>[]; scope?: string; hasMore?: boolean; fetchCount?: number; activePostId?: number | null; collectionIds?: number[] };
// Query/request/viewer scope is supplied by FeedsGate. Keep navigation memory
// bounded and never reuse one search row's results for another row or refresh.
const scopedCollections = new Map<string, CachedCollection>();
export function evictCachedDeckPost(postId: unknown): void {
  const id = Number(postId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  for (const [key, entry] of collections) {
    const feeds = entry.feeds.filter(item => Number(item?.id) !== id);
    if (feeds.length !== entry.feeds.length) {
      if (feeds.length > 0) collections.set(key, { ...entry, feeds });
      else collections.delete(key);
    }
  }
  for (const [key, entry] of scopedCollections) {
    const feeds = entry.feeds.filter(item => Number(item?.id) !== id);
    if (feeds.length !== entry.feeds.length) {
      if (feeds.length > 0) scopedCollections.set(key, { ...entry, feeds, ...(entry.collectionIds ? { collectionIds: entry.collectionIds.filter(item => item !== id) } : {}) });
      else scopedCollections.delete(key);
    }
  }
}
export const cachedDeckFeeds = (state: any, scope?: string) => {
  const entry = entryFrom(state) ?? entryFrom({ clikbDeck: state?.clikbDeckEntrance });
  const cached = collections.get(entry?.sessionId ?? state?.clikbDeckGrid?.sessionId);
  const resolved = scope == null || cached?.scope === scope ? cached
    : entry?.collectionReady === false ? scopedCollections.get(scope) : undefined;
  if (!resolved) return undefined;
  const feeds = resolved.feeds.filter(item => !isDeletedFeedPost(item?.id));
  return feeds.length === resolved.feeds.length ? resolved : { ...resolved, feeds };
};
const sessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** A category gets its own Grid predecessor before its Deck tier is pushed. */
export function deckRouteTransition(location: { state: any; search: string; hash: string }, pathname: string, state: any = {},
  config: { search?: string; openDeck?: boolean; activePostId?: number; deckEnabled?: boolean } = {}) {
  if (config.deckEnabled === false) {
    const params = new URLSearchParams(config.search ?? '');
    params.delete('deck'); params.delete('story');
    const search = params.size ? `?${params}` : '';
    // Explicit Search-card entry still opens fullscreen, with no Deck predecessor.
    if (config.activePostId != null) {
      params.set('story', String(config.activePostId));
      return { to: { pathname, search: `?${params}`, hash: location.hash }, options: { state: {
        ...state, fullscreen: false, clikbDeck: { version: 1, sessionId: sessionId(), tier: 'story',
          category: 'search', activePostId: config.activePostId, collectionIds: [], collectionReady: false,
          scroll: { x: 0, y: 0 }, returnTo: { pathname, search, hash: location.hash, state } },
      } } };
    }
    return { to: config.search == null ? pathname : { pathname, search, hash: location.hash }, options: { state } };
  }
  const current = entryFrom(location.state);
  const categories: Record<string, DeckCategory> = { '/feeds': 'all', '/images': 'shorts', '/kickit': 'cinema', '/clikit': 'games', '/pages': 'page', '/search': 'search' };
  const category = categories[pathname.toLowerCase()];
  if ((!current && !config.openDeck) || !category) return { to: config.search == null ? pathname : { pathname, search: config.search, hash: location.hash }, options: { state } };
  const params = new URLSearchParams(config.search ?? location.search);
  params.delete('deck'); params.delete('story');
  if (category !== 'search') { params.delete('q'); params.delete('section'); }
  const search = params.size ? `?${params}` : '';
  return { to: { pathname, search, hash: location.hash }, options: {
    replace: true, state: { ...state, fullscreen: false, clikbDeckEntrance: { ...current, version: 1, sessionId: sessionId(),
      tier: 'deck', category, activePostId: config.activePostId ?? null, collectionIds: [], collectionReady: false,
      scroll: { x: 0, y: 0 }, returnTo: { pathname, search, hash: location.hash, state } } },
  } };
}

/** Shared entry for Deck and sidebar Create, including fullscreen Search. */
export function openDeckCreation(
  location: { pathname: string; state: any; search: string; hash: string },
  navigate: ReturnType<typeof useNavigate>,
  openCreate: () => void,
  deckEnabled = true,
  creationRequest?: { targetPath?: '/images' | '/kickit' | '/clikit'; requestId?: string },
) {
  const pathname = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (!['/', '/feeds', '/images', '/kickit', '/clikit'].includes(pathname)
    || (creationRequest?.targetPath && pathname !== creationRequest.targetPath)) {
    const transition = deckRouteTransition(location, creationRequest?.targetPath || '/images', {
      deckCreate: true, deckCreateRequestId: creationRequest?.requestId || sessionId(),
    }, { openDeck: true, deckEnabled });
    // Create is a new destination. Keep the exact browsing entry for Back.
    navigate(transition.to, { ...transition.options, replace: false });
    return;
  }
  const current = entryFrom(location.state);
  if (!deckEnabled && (current || location.state?.fullscreen)) {
    const params = new URLSearchParams(location.search);
    params.delete('deck'); params.delete('story');
    const state = { ...location.state, fullscreen: false, deckCreate: true, deckCreateRequestId: sessionId() };
    delete state.clikbDeck; delete state.clikbDeckEntrance; delete state.clikbDeckGrid;
    // Retain fullscreen underneath an ordinary Grid/composer arrival.
    navigate({ pathname: location.pathname, search: params.size ? `?${params}` : '', hash: location.hash }, { state });
    return;
  }
  if (deckEnabled && current?.tier === 'story') {
    const params = new URLSearchParams(location.search);
    params.delete('story'); params.set('deck', String(current.activePostId));
    navigate({ pathname: location.pathname, search: `?${params}`, hash: location.hash }, {
      state: { ...location.state, clikbDeck: { ...current, tier: 'deck' }, deckCreateRequestId: sessionId() },
    });
    return;
  }
  openCreate();
}

/** Open only after the destination owns the route; old fullscreen effects stay behind. */
export function useDeckCreationRequest(openCreate: () => void, deckEnabled = true) {
  const location = useLocation();
  const handled = useRef(new Set<string>());
  const requestId = location.state?.deckCreateRequestId;
  useEffect(() => {
    if (!['/', '/feeds', '/images', '/kickit', '/clikit'].includes(location.pathname.toLowerCase())
      || typeof requestId !== 'string' || handled.current.has(requestId)
      || (deckEnabled && (location.state?.clikbDeckEntrance || entryFrom(location.state)?.tier !== 'deck'))) return;
    handled.current.add(requestId);
    if (handled.current.size > 128) handled.current.delete(handled.current.values().next().value!);
    openCreate();
  }, [location.pathname, location.state, requestId, openCreate, deckEnabled]);
}

const entryFrom = (state: any): DeckEntry | null => {
  const entry = state?.clikbDeck;
  return entry?.version === 1 && ['deck', 'story'].includes(entry.tier)
    && Array.isArray(entry.collectionIds) && entry.returnTo ? entry : null;
};

/** Router-owned overlay entries. A cycle replaces its entry; play adds one tier. */
export function useDeckNavigation(options: {
  feeds: Record<string, any>[]; category: DeckCategory; enabled: boolean; loading: boolean;
  deckEnabled?: boolean;
  autoOpen?: boolean; hasMore?: boolean; fetchCount?: number;
  collectionScope?: string;
  creationEpoch?: number;
  fullscreenPostId?: number | null;
  minimisePrompt: boolean; prepareDeck: () => void;
  onFullscreen: (postId: number | null) => void;
  getScroll: () => ScrollPoint; restoreScroll: (point: ScrollPoint) => void;
  onGridReturn?: (postId: number | null) => void;
  onCreate: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const latest = useRef(options); latest.current = options;
  const entered = useRef(Boolean(location.state?.clikbDeckGrid));
  const handledCreationEpoch = useRef(0);
  const handledEntrance = useRef<string | null>(null);
  const previous = useRef<DeckEntry | null>(null);
  const restoredGridKey = useRef<string | null>(null);
  const appliedFullscreenRoute = useRef<string | null>(null);
  const entryPath = useRef(location.pathname);
  // Search mounts three independent Feedgates; only the selected row owns history.
  const deckEnabled = options.deckEnabled !== false;
  const routeEntry = options.enabled ? entryFrom(location.state) : null;
  const ownedEntry = routeEntry && (deckEnabled || routeEntry.tier === 'story') ? routeEntry : null;
  const entrance = options.enabled && deckEnabled ? entryFrom({ clikbDeck: location.state?.clikbDeckEntrance }) : null;
  const pendingEntry = ownedEntry ?? entrance;
  // Homepage keeps all three rows loaded. Resolve a newly selected row before
  // paint instead of rendering an empty Deck and rebuilding it on another route.
  let entry = pendingEntry;
  const hasMatchingCollection = Boolean(
    pendingEntry?.collectionIds?.length &&
    pendingEntry.collectionIds.some(id => options.feeds.some(post => Number(post.id) === id))
  );
  if (!options.loading && pendingEntry && (pendingEntry.collectionReady === false || !hasMatchingCollection)) {
    const remembered = options.collectionScope ? scopedCollections.get(options.collectionScope) : undefined;
    const requestedId = pendingEntry.activePostId ?? remembered?.activePostId;
    const requestedIndex = options.feeds.findIndex(post => Number(post.id) === requestedId);
    const start = requestedIndex < 0 ? 0 : Math.floor(requestedIndex / DECK_PAGE_SIZE) * DECK_PAGE_SIZE;
    const ids = options.feeds.slice(start, start + DECK_PAGE_SIZE).map(post => Number(post.id));
    if (ids.length > 0) {
      const rememberedIds = remembered?.collectionIds?.filter(id => options.feeds.some(post => Number(post.id) === id));
      const collectionIds = pendingEntry.activePostId == null && requestedIndex >= 0 && rememberedIds?.includes(Number(requestedId)) ? rememberedIds : ids;
      entry = { ...pendingEntry, collectionReady: true, collectionIds,
        activePostId: requestedIndex < 0 ? collectionIds[0] ?? null : Number(requestedId) };
    }
  }
  const liveEntry = useRef(entry); liveEntry.current = entry;
  const ownsHistory = !!ownedEntry;
  const isDeckOpen = entry?.tier === 'deck';
  const posts = useMemo(() => new Map(options.feeds.map(post => [Number(post.id), post])), [options.feeds]);
  const primaryCards = entry?.collectionIds?.flatMap(id => posts.has(id) ? [posts.get(id)!] : []) ?? [];
  const cards = primaryCards.length > 0 ? primaryCards : (!options.loading && options.feeds.length > 0 ? options.feeds.slice(0, DECK_PAGE_SIZE) : []);
  const activePostId = (entry?.activePostId != null && posts.has(entry.activePostId) ? entry.activePostId : null) ?? (cards[0] ? Number(cards[0].id) : entry?.activePostId ?? null);
  if (entry && !options.loading) {
    const savedFeeds = options.feeds.some(post => isDeletedFeedPost(post?.id))
      ? options.feeds.filter(post => !isDeletedFeedPost(post?.id))
      : options.feeds;
    const saved = { feeds: savedFeeds, scope: options.collectionScope, hasMore: options.hasMore, fetchCount: options.fetchCount, activePostId, collectionIds: entry.collectionIds };
    rememberSession(collections, entry.sessionId, saved);
    if (options.collectionScope) {
      scopedCollections.delete(options.collectionScope);
      scopedCollections.set(options.collectionScope, saved);
      if (scopedCollections.size > 24) scopedCollections.delete(scopedCollections.keys().next().value!);
    }
  }

  const write = useCallback((next: DeckEntry, replace: boolean) => {
    if (latest.current.deckEnabled === false && next.tier === 'deck') return;
    const currentHistory = window.history.state;
    const preserveCreation = replace && !latest.current.minimisePrompt && currentHistory?.clikbPromptInput
      && currentHistory?.usr?.clikbDeck?.sessionId === next.sessionId && next.tier === 'deck';
    const params = new URLSearchParams(location.search);
    params.delete('deck'); params.delete('story');
    if (next.activePostId != null) params.set(next.tier === 'story' ? 'story' : 'deck', String(next.activePostId));
    const state = { ...location.state, fullscreen: false, clikbDeck: next };
    delete state.clikbDeckEntrance;
    navigate({ pathname: location.pathname, search: params.size ? `?${params}` : '', hash: location.hash }, { replace, state });
    if (preserveCreation) {
      // Hydrating the browsing backdrop must retain the protected composer and
      // its current Creation Deck/workstation layer on this same history entry.
      window.history.replaceState({ ...window.history.state,
        clikbPromptInput: currentHistory.clikbPromptInput,
        ...(currentHistory.clikbCreationDeck?.promptId === currentHistory.clikbPromptInput.id
          ? { clikbCreationDeck: currentHistory.clikbCreationDeck } : {}),
      }, '');
    }
  }, [location.pathname, location.search, location.hash, location.state, navigate]);
  const checkpointGrid = (id: string, scroll: ScrollPoint, restoreExact = false) => {
    const state = { ...location.state, fullscreen: false, clikbDeckGrid: { sessionId: id, scroll, restoreExact } };
    delete state.clikbDeck;
    delete state.clikbDeckEntrance;
    delete state.clikbGridScroll;
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      replace: true, state,
    });
  };

  const openPost = useCallback((postId: number) => {
    const current = latest.current;
    const index = current.feeds.findIndex(post => Number(post.id) === Number(postId));
    if (!current.enabled || index < 0) return;
    current.prepareDeck();
    entered.current = true;
    const start = Math.floor(index / DECK_PAGE_SIZE) * DECK_PAGE_SIZE;
    const id = sessionId();
    const scroll = current.getScroll();
    rememberSession(collections, id, { feeds: current.feeds, scope: current.collectionScope, hasMore: current.hasMore, fetchCount: current.fetchCount });
    checkpointGrid(id, scroll, current.deckEnabled === false);
    write({ sessionId: id, collectionReady: true, version: 1, tier: current.deckEnabled === false ? 'story' : 'deck', activePostId: Number(postId),
      collectionIds: current.feeds.slice(start, start + DECK_PAGE_SIZE).map(post => Number(post.id)),
      category: current.category, scroll,
      returnTo: { pathname: location.pathname, search: location.search, hash: location.hash, state: location.state },
    }, false);
  }, [write, location.pathname, location.search, location.hash, location.state]);

  // Only the first regular entry opens automatically. Back to Grid stays Grid.
  useLayoutEffect(() => {
    if (entryPath.current !== location.pathname) {
      entryPath.current = location.pathname;
      entered.current = Boolean(location.state?.clikbDeckGrid);
    }
    if (entrance && !ownedEntry) {
      // Feed hydration can rerender before the router commits these writes.
      if (handledEntrance.current === entrance.sessionId) return;
      handledEntrance.current = entrance.sessionId;
      entered.current = true;
      checkpointGrid(entrance.sessionId, entrance.scroll);
      write(entry!, false);
      return;
    }
    if (entry) {
      entered.current = true;
      const focus = fullscreenFocus.get(entry.sessionId);
      if (entry.tier === 'deck' && focus) {
        fullscreenFocus.delete(entry.sessionId);
        if (focus.activePostId !== entry.activePostId) { write({ ...entry, ...focus }, true); return; }
      }
      if (entry !== pendingEntry && (ownedEntry?.collectionReady === false || !hasMatchingCollection) && entry.collectionReady && !options.loading) {
        write(entry, true);
      }
      return;
    }
    if (entered.current || !options.enabled || !deckEnabled) return;
    if (options.autoOpen === false) { entered.current = true; return; }
    entered.current = true;
    const storyParam = Number(new URLSearchParams(location.search).get('story'));
    const isStory = !Number.isNaN(storyParam) && storyParam > 0;
    const requested = isStory ? storyParam : Number(new URLSearchParams(location.search).get('deck'));
    const target = options.loading ? undefined : options.feeds.find(post => Number(post.id) === requested) ?? options.feeds[0];
    const start = target ? Math.floor(options.feeds.indexOf(target) / DECK_PAGE_SIZE) * DECK_PAGE_SIZE : 0;
    const id = sessionId();
    const scroll = options.getScroll();
    if (!options.loading) rememberSession(collections, id, { feeds: options.feeds, scope: options.collectionScope, hasMore: options.hasMore, fetchCount: options.fetchCount });
    checkpointGrid(id, scroll);
    write({ sessionId: id, collectionReady: !options.loading, version: 1, tier: isStory ? 'story' : 'deck', activePostId: target ? Number(target.id) : null,
      collectionIds: options.loading ? [] : options.feeds.slice(start, start + DECK_PAGE_SIZE).map(post => Number(post.id)),
      category: options.category, scroll,
      returnTo: { pathname: location.pathname, search: location.search, hash: location.hash, state: location.state },
    }, false);
  }, [entry, options.enabled, deckEnabled, options.autoOpen, options.loading, options.feeds, options.category, options.minimisePrompt, location, write]);

  useLayoutEffect(() => {
    let frame = 0;
    if (entry) {
      restoredGridKey.current = null;
      latest.current.onFullscreen(entry.tier === 'story' && !options.loading ? entry.activePostId : null);
    } else if (previous.current || (options.enabled && location.state?.clikbDeckGrid)) {
      latest.current.onFullscreen(null);
      const point = previous.current?.scroll ?? location.state.clikbDeckGrid.scroll;
      const postId = previous.current?.activePostId
        ?? cachedDeckFeeds(location.state)?.activePostId ?? null;
      if (!options.loading && restoredGridKey.current !== location.key) frame = requestAnimationFrame(() => {
        restoredGridKey.current = location.key;
        latest.current.restoreScroll(point);
        latest.current.onGridReturn?.(location.state?.clikbDeckGrid?.restoreExact ? null : postId);
      });
    }
    previous.current = entry;
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [location.key, options.feeds, options.loading, deckEnabled]);

  // The existing viewer reports its actual displayed identity, not its launch index.
  useLayoutEffect(() => {
    const postId = options.fullscreenPostId;
    const routeChanged = appliedFullscreenRoute.current !== location.key;
    appliedFullscreenRoute.current = location.key;
    if (entry?.tier !== 'story' || options.loading || postId == null) return;
    // A new router entry owns restoration. Its onFullscreen update above has
    // not rendered yet, so this commit may still report the preceding post.
    // Only viewer changes within an already-applied route can write focus back.
    if (routeChanged) return;
    const index = options.feeds.findIndex(post => Number(post.id) === postId);
    if (index < 0) return;
    const start = Math.floor(index / DECK_PAGE_SIZE) * DECK_PAGE_SIZE;
    const focus = { activePostId: postId,
      collectionIds: options.feeds.slice(start, start + DECK_PAGE_SIZE).map(post => Number(post.id)) };
    rememberSession(fullscreenFocus, entry.sessionId, focus);
    if (entry.activePostId !== postId) write({ ...entry, ...focus }, true);
  }, [entry, options.fullscreenPostId, options.loading, options.feeds, write, location.key]);

  const selectPost = useCallback((id: number) => {
    if (entry?.tier !== 'deck') return;
    const validIds = entry.collectionIds.some(cid => posts.has(cid))
      ? entry.collectionIds
      : cards.map(post => Number(post.id));
    if (!validIds.includes(Number(id))) return;
    write({ ...entry, collectionReady: true, collectionIds: validIds, activePostId: Number(id) }, true);
  }, [entry, posts, cards, write]);
  const play = useCallback(() => {
    if (entry?.tier !== 'deck' || latest.current.deckEnabled === false) return;
    const targetId = entry.activePostId != null && posts.has(entry.activePostId)
      ? entry.activePostId
      : activePostId;
    if (targetId == null || !posts.has(targetId)) return;
    const validIds = entry.collectionIds.some(cid => posts.has(cid))
      ? entry.collectionIds
      : cards.map(post => Number(post.id));
    write({ ...entry, collectionReady: true, collectionIds: validIds, activePostId: targetId, tier: 'story' }, false);
  }, [entry, activePostId, cards, write, posts]);
  useLayoutEffect(() => {
    if (!options.enabled || !deckEnabled || options.minimisePrompt || !options.creationEpoch || handledCreationEpoch.current === options.creationEpoch) return;
    handledCreationEpoch.current = options.creationEpoch;
    if (entry) {
      if (entry.tier === 'story') write({ ...entry, tier: 'deck' }, true);
      return;
    }
    entered.current = true;
    const id = sessionId(), scroll = options.getScroll();
    const remembered = options.collectionScope ? scopedCollections.get(options.collectionScope) : undefined;
    const collectionIds = (remembered?.collectionIds || options.feeds.slice(0, DECK_PAGE_SIZE).map(post => Number(post.id)))
      .filter(postId => options.feeds.some(post => Number(post.id) === postId));
    checkpointGrid(id, scroll);
    write({ sessionId: id, version: 1, tier: 'deck', category: options.category,
      activePostId: collectionIds.includes(Number(remembered?.activePostId)) ? Number(remembered?.activePostId) : collectionIds[0] ?? null,
      collectionIds, collectionReady: !options.loading, scroll,
      returnTo: { pathname: location.pathname, search: location.search, hash: location.hash, state: location.state } }, false);
  }, [options.creationEpoch, options.enabled, deckEnabled, options.minimisePrompt, entry, write]);
  const close = useCallback(() => {
    if (!entry || (entry.tier === 'deck' && latest.current.deckEnabled === false)) return;
    if (!latest.current.minimisePrompt) {
      // Change only the backdrop. Browser Back belongs to Creation's draft guard.
      const params = new URLSearchParams(location.search);
      params.delete('deck'); params.delete('story');
      const state = { ...location.state, fullscreen: false, clikbDeckGrid: { sessionId: entry.sessionId, scroll: entry.scroll } };
      delete state.clikbDeck; delete state.clikbDeckEntrance;
      navigate({ pathname: location.pathname, search: params.size ? `?${params}` : '', hash: location.hash }, { replace: true, state });
      return;
    }
    // Every owned tier has an app-created predecessor, including initial auto-open.
    navigate(-1);
  }, [entry, navigate, location]);
  const minimiseAtRender = options.minimisePrompt;
  const showPage = useCallback((ids: number[]) => {
    // A request started before Creation opened is stale; an explicit request
    // from its still-visible Next collection control remains valid.
    if (latest.current.minimisePrompt !== minimiseAtRender) return;
    const currentHistory = entryFrom(window.history.state?.usr);
    if (entry?.tier !== 'deck' || !ids.length || liveEntry.current?.tier !== 'deck'
      || liveEntry.current.sessionId !== entry.sessionId || currentHistory?.tier !== 'deck'
      || currentHistory.sessionId !== entry.sessionId) return;
    write({ ...entry, collectionIds: ids.slice(0, DECK_PAGE_SIZE), activePostId: ids[0] }, true);
  }, [entry, write, minimiseAtRender]);
  const create = useCallback(() => {
    openDeckCreation(location, navigate, () => latest.current.onCreate(), latest.current.deckEnabled !== false);
  }, [location, navigate]);

  useEffect(() => {
    if (entry?.tier !== 'deck' || !options.minimisePrompt) return;
    // Fullscreen's existing child-panel/Back bindings retain their precedence.
    return registerSharedBack('clikb.feeds.deck', { priority: 100,
      label: 'Return to feed grid', back: close });
  }, [entry, close, options.minimisePrompt]);
  useEffect(() => {
    if (!isDeckOpen || !options.minimisePrompt) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [isDeckOpen, close, options.minimisePrompt]);
  return { isDeckOpen, ownsHistory, activePostId, cards, openPost, selectPost, play, close, create, showPage };
}
