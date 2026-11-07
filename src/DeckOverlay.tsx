import AutoControlPill from './AutoControlPill';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useDeckStageFit } from './useDeckStageFit';
import { useDispatch, useSelector } from 'react-redux';
import { publishFeedsArea, removeFeedsArea } from './brainstormSlice';
import { setPlaybackMuted, setDeckCleanMode, setDeckCardCount } from './settingsSlice';
import { createDeckPreviewLifecycle, releaseDeckPreviewMedia, type DeckPreviewLifecycle } from './deckPreviewLifecycle';
import { consumeDeckWheel, createDeckWheelGesture, deckGestureAxis, deckVerticalTarget, type DeckGestureAxis } from './deckGestures';
import { preloadDeckPoster } from './deckPosterPreload';
import type { RootState } from './store';
import { applyFeedCardOcclusion, measureFeedCardVisibility } from './feedsControlSnapshot';
import { DECK_AREA_ID, DECK_CATEGORIES, DECK_SEARCH_SECTIONS, buildDeckSnapshot, deckActiveIndex, deckPostTitle, deckPosterSource, deckPreviewKind, deckVideoSource, normaliseDeckCards, type DeckCategory, type DeckPost, type DeckSearchSection, type DeckSearchCollection } from './deckControlSnapshot';
import './DeckOverlay.css';
import { CreationDraftAction } from './creationDrafts/actions';

export type DeckOverlayProps = {
  cards: Record<string, any>[];
  activePostId: number | null;
  category: DeckCategory;
  profile?: { id: number; username: string; image?: string };
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  onSelectPost: (postId: number) => void;
  onPlay: () => void;
  onPaginate: () => void | Promise<void>;
  onCategory: (category: DeckCategory) => void;
  onVisitProfile?: (memberId: number, postId: number) => void;
  onClose: () => void;
  onCreate: () => void;
  onDockHost: (node: HTMLElement | null) => void;
  isMenuOpen: boolean;
  MenuOpenb?: boolean;
  /** Creation composer is open on top; Deck stays as an inert backdrop. */
  composing?: boolean;
  search?: { section: DeckSearchSection; query: string; requestId?: string; collections?: DeckSearchCollection[]; onSection: (section: DeckSearchSection) => void; onSearch: (query: string) => void };
};

const Icon = ({ kind }: { kind: 'next' | 'prev' | 'pages' | 'close' | 'play' | 'mute' | 'sound' | 'add' | 'chevron' | 'pause' | 'zoom-out' | 'zoom-in' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={kind === 'add' ? '2' : '1.8'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'next' ? <path d="m9 5 7 7-7 7" /> : kind === 'prev' ? <path d="m15 5-7 7 7 7" /> :
      kind === 'pages' ? <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></> :
      kind === 'close' ? <path d="m6 6 12 12M6 18 18 6" /> : kind === 'play' ? <path d="m9 4 11 8-11 8V4Z" /> :
      kind === 'chevron' ? <path d="m6 9 6 6 6-6" /> : kind === 'pause' ? <path d="M8 5v14M16 5v14" /> :
      kind === 'zoom-out' ? <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M10 14l-7 7" /> :
      kind === 'zoom-in' ? <path d="M14 4h6v6M4 14v6h6m3-9 7-7M4 20l7-7" /> :
      kind === 'add' ? <path d="M12 6v12M6 12h12" /> : <><path d="m11 4-6 5H2v6h3l6 5V4Z" />{kind === 'mute' ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14" /></>}</>}
  </svg>
);

const previewLabel = (post: DeckPost): string => {
  const kind = deckPreviewKind(post);
  return kind === 'spatial' ? 'Spatial / 3D' : kind === 'game' ? 'Interactive game' : kind === 'touch' ? 'Touch experience' : kind === 'video' ? 'Video' : 'Story';
};

// A mode switch can remount Deck while the same trackpad gesture is coasting.
const wheelGesture = createDeckWheelGesture();
let verticalArrival: { target: string; direction: number; at: number } | null = null;

function DeckPoster({ src }: { src: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const attach = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setStatus(node.naturalWidth ? 'ready' : 'error');
  }, []);
  return <>
    <span className={`deck-card-back${status === 'loading' ? ' deck-card-back--loading' : ''}`} aria-hidden="true">◇</span>
    <img ref={attach} src={src} alt="" draggable={false} decoding="async" loading="eager"
      className="deck-card-poster" data-ready={status === 'ready'} style={status === 'error' ? { display: 'none' } : undefined}
      onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />
  </>;
}

/** A presentation layer over the mounted feeds and composer. App owns routes and history. */
export default function DeckOverlay(props: DeckOverlayProps) {
  const { activePostId, category, loading, hasMore, error, onSelectPost, onPlay, onPaginate, onCategory, onClose, onCreate, onDockHost, isMenuOpen, MenuOpenb } = props;
  const isBMenuOpen = Boolean(!isMenuOpen && MenuOpenb);
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);
  const activeMemberId = useSelector((state: RootState) => state.profile.loggedUser?.id);
  const cardsRef = useRef<DeckPost[]>([]);
  const cards = useMemo(() => {
    const next = normaliseDeckCards(props.cards);
    const prev = cardsRef.current;
    if (prev.length === next.length && prev.every((card, index) => card === next[index])) return prev;
    cardsRef.current = next;
    return next;
  }, [props.cards]);
  const activeIndex = deckActiveIndex(cards, activePostId);
  const active = activeIndex >= 0 ? cards[activeIndex] : null;
  const activeId = active ? Number(active.id) : null;
  const videoSource = active && deckPreviewKind(active) === 'video' ? deckVideoSource(active) : '';
  const muted = settings.fullscreenMute;
  const playbackSettingsRef = useRef({ muted, volume: settings.playbackVolume });
  playbackSettingsRef.current = { muted, volume: settings.playbackVolume };
  const deckCardCount = settings.deckCardCount ?? 3;
  const cleanDeck = Boolean(settings.deckCleanMode);
  const [showMoreCue, setShowMoreCue] = useState(false);
  const [showZoomCue, setShowZoomCue] = useState(false);
  const [showCloseCue, setShowCloseCue] = useState(true);
  const showCleanCues = cleanDeck && !props.composing;
  const showNormalCues = !cleanDeck && !props.composing;
  useEffect(() => {
    setShowZoomCue(showNormalCues);
    if (!showNormalCues) return;
    const timer = setTimeout(() => setShowZoomCue(false), 6000);
    return () => clearTimeout(timer);
  }, [showNormalCues]);
  useEffect(() => {
    const timer = setTimeout(() => setShowCloseCue(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setShowMoreCue(false);
    if (!showCleanCues) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const showTimer = setTimeout(() => {
      setShowMoreCue(true);
      hideTimer = setTimeout(() => setShowMoreCue(false), 2000);
    }, 3500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [showCleanCues]);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowVisible, setSlideshowVisible] = useState(() => !document.hidden);
  const [slideshowRevision, setSlideshowRevision] = useState(0);
  const slideshowActiveRef = useRef(false);
  const slideshowEpochRef = useRef(0);
  const slideshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideshowPendingRef = useRef<{ epoch: number; collectionKey: string; settled: boolean; deadline: number } | null>(null);
  const collectionKey = cards.map(post => Number(post.id)).join(',');
  const slideshowObservedCollectionRef = useRef(collectionKey);
  const slideshowLatestRef = useRef({ cards, activeIndex, collectionKey, loading, hasMore, error, onSelectPost, onPaginate });
  slideshowLatestRef.current = { cards, activeIndex, collectionKey, loading, hasMore, error, onSelectPost, onPaginate };
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [searchSelectorOpen, setSearchSelectorOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(props.search?.query || '');
  const searchSelectorRef = useRef<HTMLDivElement>(null);
  const searchCollectionsKey = JSON.stringify(props.search?.collections || []);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewLifecycleRef = useRef<DeckPreviewLifecycle | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  const [cardVisibility, setCardVisibility] = useState<Array<{ postId: number; visiblePercent: number; fullyVisible: boolean; occluded: boolean }>>([]);
  const selectorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; axis: DeckGestureAxis | null; captured: boolean; owner: HTMLElement } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const profile = category === 'page' ? props.profile : undefined;
  const isOwnPage = !profile || profile.id === Number(activeMemberId);
  const categoryLabel = category === 'page' && !isOwnPage ? 'Page'
    : DECK_CATEGORIES.find(item => item.id === category)?.label || 'All Feeds';
  const profileLabel = profile?.username ? `@${profile.username.replace(/^@/, '')}` : '';
  const categorySelected = (id: DeckCategory) => id === category && (id !== 'page' || isOwnPage);
  const modeKey = props.search ? `search:${props.search.section}` : category;
  useDeckStageFit(stageRef, `${modeKey}:${cleanDeck}`);
  const arrivalDirection = verticalArrival?.target === modeKey && performance.now() - verticalArrival.at < 1000 ? verticalArrival.direction : 0;

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    const previous = videoRef.current;
    if (previous === node) return;
    const lifecycle = previewLifecycleRef.current;
    if (lifecycle) lifecycle.dispose();
    else if (previous) releaseDeckPreviewMedia(previous);
    previewLifecycleRef.current = null;
    videoRef.current = node;
  }, []);
  const stopPreview = useCallback(() => {
    if (previewLifecycleRef.current) previewLifecycleRef.current.dispose();
    else if (videoRef.current) releaseDeckPreviewMedia(videoRef.current);
    setMediaPlaying(false);
  }, []);
  const closeDeck = () => { stopSlideshow(); stopPreview(); onClose(); };
  const createFromDeck = () => { stopSlideshow(); stopPreview(); onCreate(); };
  const playFromDeck = () => { stopSlideshow(); stopPreview(); onPlay(); };

  const clearSlideshowTimer = useCallback(() => {
    if (slideshowTimerRef.current != null) clearTimeout(slideshowTimerRef.current);
    slideshowTimerRef.current = null;
  }, []);
  const stopSlideshow = useCallback(() => {
    clearSlideshowTimer();
    slideshowEpochRef.current++;
    slideshowActiveRef.current = false;
    slideshowPendingRef.current = null;
    setSlideshowActive(false);
  }, [clearSlideshowTimer]);
  const toggleSlideshow = () => {
    setCategorySelectorOpen(false);
    if (slideshowActiveRef.current) { stopSlideshow(); return; }
    slideshowEpochRef.current++;
    slideshowPendingRef.current = null;
    slideshowActiveRef.current = true;
    setSlideshowActive(true);
  };

  useEffect(() => {
    const previousCollection = slideshowObservedCollectionRef.current;
    slideshowObservedCollectionRef.current = collectionKey;
    if (!slideshowActive) return;
    if (previousCollection !== collectionKey && !slideshowPendingRef.current) { stopSlideshow(); return; }
    if (error || (!loading && slideshowLatestRef.current.cards.length === 0)) { stopSlideshow(); return; }
    if (!slideshowVisible || document.hidden) return;
    if (loading) return;
    const pending = slideshowPendingRef.current;
    if (pending) {
      if (!pending.settled) return;
      if (pending.collectionKey !== collectionKey) slideshowPendingRef.current = null;
      else if (!hasMore) {
        slideshowPendingRef.current = null;
        const current = slideshowLatestRef.current;
        if (current.activeIndex > 0) current.onSelectPost(Number(current.cards[0].id));
        else setSlideshowRevision(value => value + 1);
        return;
      } else if (Date.now() < pending.deadline) {
        // A resolved feed request may precede the router's collection commit.
        slideshowTimerRef.current = setTimeout(() => setSlideshowRevision(value => value + 1), pending.deadline - Date.now());
        return clearSlideshowTimer;
      } else { stopSlideshow(); return; }
    }
    slideshowTimerRef.current = setTimeout(() => {
      slideshowTimerRef.current = null;
      const current = slideshowLatestRef.current;
      if (!slideshowActiveRef.current || document.hidden || current.loading || current.error || !current.cards.length) return;
      if (current.activeIndex < current.cards.length - 1) {
        current.onSelectPost(Number(current.cards[current.activeIndex + 1].id));
      } else if (!current.hasMore) {
        if (current.cards.length > 1) current.onSelectPost(Number(current.cards[0].id));
        else setSlideshowRevision(value => value + 1);
      } else {
        const request = { epoch: slideshowEpochRef.current, collectionKey: current.collectionKey, settled: false, deadline: 0 };
        slideshowPendingRef.current = request;
        Promise.resolve().then(() => current.onPaginate()).then(() => {
          if (!slideshowActiveRef.current || request.epoch !== slideshowEpochRef.current || slideshowPendingRef.current !== request) return;
          request.settled = true;
          request.deadline = Date.now() + 1500;
          setSlideshowRevision(value => value + 1);
        }).catch(() => { if (slideshowActiveRef.current && request.epoch === slideshowEpochRef.current) stopSlideshow(); });
      }
    }, 12000);
    return clearSlideshowTimer;
  }, [slideshowActive, slideshowVisible, slideshowRevision, activeId, collectionKey, loading, hasMore, error, clearSlideshowTimer, stopSlideshow]);

  useEffect(() => {
    const visibility = () => { if (document.hidden) clearSlideshowTimer(); setSlideshowVisible(!document.hidden); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); clearSlideshowTimer(); slideshowEpochRef.current++; slideshowActiveRef.current = false; slideshowPendingRef.current = null; };
  }, [clearSlideshowTimer, stopSlideshow]);

  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    const click = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-ai-action="clikb.feeds.deck.action.toggle_slideshow"], [data-ai-action="clikb.feeds.deck.action.select_category"]')) stopSlideshow();
    };
    // Native capture also sees the same concierge's portal inside the dock.
    root.addEventListener('click', click, true);
    return () => root.removeEventListener('click', click, true);
  }, [stopSlideshow]);

  const cycle = useCallback((direction: number) => {
    if (cards.length < 2 || loading) return;
    onSelectPost(Number(cards[(activeIndex + direction + cards.length) % cards.length].id));
  }, [cards, activeIndex, onSelectPost, loading]);

  const cycleMode = useCallback((direction: number) => {
    if (props.composing || categorySelectorOpen || searchSelectorOpen) return;
    const target = deckVerticalTarget(category, props.search?.section, direction);
    if (!target) return;
    stopSlideshow(); stopPreview();
    verticalArrival = { target: props.search ? `search:${target}` : target, direction, at: performance.now() };
    if (props.search) props.search.onSection(target as DeckSearchSection);
    else onCategory(target);
  }, [category, props.search, props.composing, onCategory, categorySelectorOpen, searchSelectorOpen, stopSlideshow, stopPreview]);
  useEffect(() => { if (props.composing) { stopSlideshow(); stopPreview(); } }, [props.composing, stopSlideshow, stopPreview]);

  useEffect(() => {
    if (cards.length < 2 || activeIndex < 0 || typeof Image === 'undefined') return;
    for (const offset of [1, -1, 2, -2, 3]) {
      const candidate = cards[(activeIndex + offset + cards.length) % cards.length];
      const poster = candidate ? deckPosterSource(candidate) : '';
      if (!poster) continue;
      preloadDeckPoster(poster);
    }
  }, [cards, activeIndex]);

  useEffect(() => {
    setMediaFailed(false);
    setAutoplayBlocked(false);
    setMediaPlaying(false);
    const video = videoRef.current;
    if (!video || !videoSource || props.composing) return;
    const lifecycle: DeckPreviewLifecycle = createDeckPreviewLifecycle(video, {
      source: videoSource, playback: () => playbackSettingsRef.current,
      isCurrent: () => videoRef.current === video && previewLifecycleRef.current === lifecycle,
      isVisible: () => !document.hidden, onPlaying: setMediaPlaying, onBlocked: setAutoplayBlocked,
    });
    previewLifecycleRef.current = lifecycle;
    const visibility = () => { if (document.hidden) lifecycle.pause(); else lifecycle.start(); };
    document.addEventListener('visibilitychange', visibility);
    lifecycle.start();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      lifecycle.dispose();
      if (previewLifecycleRef.current === lifecycle) previewLifecycleRef.current = null;
    };
  }, [activeId, videoSource, props.composing]);

  useEffect(() => { if (videoRef.current && previewLifecycleRef.current?.isActive()) { videoRef.current.muted = muted; videoRef.current.volume = settings.playbackVolume; } }, [muted, settings.playbackVolume, activeId]);
  useEffect(() => { setCategorySelectorOpen(false); setSearchSelectorOpen(false); stopSlideshow(); }, [category, props.search?.section, props.search?.query, stopSlideshow]);
  useEffect(() => { setSearchInput(props.search?.query || ''); }, [props.search?.query]);

  const resumePreview = () => {
    previewLifecycleRef.current?.start();
  };

  useEffect(() => {
    dispatch(publishFeedsArea(buildDeckSnapshot({
      cards, activePostId: activeId, category, loading, hasMore, error, muted,
      autoControlEnabled: settings.autoControlEnabled, categorySelectorOpen, mediaPlaying, autoplayBlocked,
      composing: props.composing, cleanMode: cleanDeck,
      creatorProfileAvailable: Boolean(props.onVisitProfile),
      ...(profile ? { profileOwnerId: profile.id, profileUsername: profile.username, pageIsOwn: isOwnPage } : {}),
      cardVisibility, slideshowActive,
      ...(props.search ? { search: { section: props.search.section, query: props.search.query, input: searchInput, selectorOpen: searchSelectorOpen, requestId: props.search.requestId, collections: props.search.collections } } : {}),
    })));
  }, [dispatch, cards, activeId, category, loading, hasMore, error, muted, settings.autoControlEnabled, categorySelectorOpen, mediaPlaying, autoplayBlocked, cardVisibility, slideshowActive, cleanDeck, props.composing, props.search?.section, props.search?.query, props.search?.requestId, searchInput, searchSelectorOpen, searchCollectionsKey, profile?.id, profile?.username, isOwnPage, props.onVisitProfile]);
  useEffect(() => () => { dispatch(removeFeedsArea({ areaId: DECK_AREA_ID, source: 'DeckOverlay' })); }, [dispatch]);

  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      const viewport = { top: Math.max(0, rect.top), bottom: Math.min(innerHeight, rect.bottom), left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right) };
      const next = [...root.querySelectorAll<HTMLElement>('[data-deck-post-id]')].map(card => {
        const bounds = card.getBoundingClientRect();
        const geometry = measureFeedCardVisibility(bounds, viewport);
        const left = Math.max(bounds.left, viewport.left), right = Math.min(bounds.right, viewport.right);
        const top = Math.max(bounds.top, viewport.top), bottom = Math.min(bounds.bottom, viewport.bottom);
        let clear = 0, count = 0;
        if (right > left && bottom > top) for (const y of [0.15, 0.5, 0.85]) for (const x of [0.15, 0.5, 0.85]) {
          const hit = document.elementFromPoint(left + (right - left) * x, top + (bottom - top) * y);
          count++;
          if (hit && card.contains(hit)) clear++;
        }
        return { postId: Number(card.dataset.deckPostId), ...applyFeedCardOcclusion(geometry, clear, count) };
      });
      setCardVisibility(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const queueMeasure = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queueMeasure);
    resizeObserver?.observe(root);
    const stage = root.querySelector('.deck-stage');
    if (stage) resizeObserver?.observe(stage);
    window.addEventListener('resize', queueMeasure);
    root.addEventListener('animationend', queueMeasure);
    queueMeasure();
    return () => { if (frame) cancelAnimationFrame(frame); resizeObserver?.disconnect(); window.removeEventListener('resize', queueMeasure); root.removeEventListener('animationend', queueMeasure); };
  }, [cards, activeId, categorySelectorOpen, searchSelectorOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (props.composing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,[contenteditable="true"],[data-deck-concierge-host]')) return;
      if (event.key === 'Escape' && (categorySelectorOpen || searchSelectorOpen)) { event.preventDefault(); event.stopPropagation(); setCategorySelectorOpen(false); setSearchSelectorOpen(false); }
      else if (categorySelectorOpen || searchSelectorOpen) return;
      else if (event.key === 'ArrowLeft') { stopSlideshow(); event.preventDefault(); cycle(-1); }
      else if (event.key === 'ArrowRight') { stopSlideshow(); event.preventDefault(); cycle(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); cycleMode(-1); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); cycleMode(1); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cycle, cycleMode, categorySelectorOpen, searchSelectorOpen, stopSlideshow, props.composing]);

  useEffect(() => {
    if (!categorySelectorOpen && !searchSelectorOpen) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setCategorySelectorOpen(false);
      if (!searchSelectorRef.current?.contains(event.target as Node)) setSearchSelectorOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [categorySelectorOpen, searchSelectorOpen]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    stopSlideshow();
    // Keep the browser's mobile screen-edge Back gesture outside the card drag.
    if (props.composing || categorySelectorOpen || searchSelectorOpen || event.button !== 0 || !event.isPrimary || (event.pointerType === 'touch' && event.clientX < 24)
      || (event.target as HTMLElement).closest('[data-deck-no-drag]')) { pointerRef.current = null; return; }
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, captured: false, owner: event.currentTarget };
  };
  const releasePointer = useCallback(() => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (start?.captured && start.owner.hasPointerCapture(start.id)) start.owner.releasePointerCapture(start.id);
  }, []);
  useEffect(() => () => { releasePointer(); }, [releasePointer]);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = pointerRef.current;
    if (!start || start.id !== event.pointerId) return;
    const x = event.clientX - start.x, y = event.clientY - start.y;
    start.axis ||= deckGestureAxis(x, y);
    if (!start.captured && start.axis) {
      start.owner.setPointerCapture(start.id);
      start.captured = true;
    }
    if (start.captured) event.preventDefault();
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerRef.current;
    releasePointer();
    if (!start || start.id !== event.pointerId) return;
    const x = event.clientX - start.x, y = event.clientY - start.y;
    if (start.captured) suppressClickUntilRef.current = Date.now() + 400;
    const axis = start.axis;
    if (!axis || Math.abs(axis === 'x' ? x : y) < 45) return;
    suppressClickUntilRef.current = Date.now() + 400;
    if (axis === 'x') cycle(x < 0 ? 1 : -1);
    else cycleMode(y < 0 ? 1 : -1);
  };
  const onPointerCancel = () => {
    if (pointerRef.current?.captured) suppressClickUntilRef.current = Date.now() + 400;
    releasePointer();
  };
  const onLostPointerCapture = (event: PointerEvent<HTMLElement>) => {
    // Touch starts with implicit capture on the card. Its capture-loss event
    // bubbles here when the stage takes over; the swipe is still active.
    if (event.target !== event.currentTarget || pointerRef.current?.id !== event.pointerId) return;
    onPointerCancel();
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const wheel = (event: WheelEvent) => {
      if (props.composing || event.ctrlKey || categorySelectorOpen || searchSelectorOpen || (event.target as HTMLElement).closest('[data-deck-no-drag]')) return;
      // Contain trackpad history overscroll only on the Deck stage. Toolbar Back,
      // Alt-Left and gestures over the sidebar/other app surfaces remain native.
      event.preventDefault();
      stopSlideshow();
      const x = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientWidth : 1);
      const y = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      const gesture = consumeDeckWheel(wheelGesture, x, y, performance.now());
      if (gesture?.axis === 'x') cycle(gesture.direction);
      else if (gesture?.axis === 'y') cycleMode(gesture.direction);
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  }, [cycle, cycleMode, categorySelectorOpen, searchSelectorOpen, stopSlideshow, props.composing]);

  const renderCard = (post: DeckPost, position: 'prev2' | 'prev' | 'active' | 'next' | 'next2') => {
    const center = position === 'active';
    const poster = deckPosterSource(post);
    const title = deckPostTitle(post);
    const username = typeof post.username === 'string' ? post.username.replace(/^@/, '') : '';
    const creatorId = Number(post.sender);
    const canVisitCreator = center && Boolean(props.onVisitProfile) && Number.isSafeInteger(creatorId) && creatorId > 0;
    return <article key={`${position}.${post.id}`} className={`deck-card deck-card--${position}`} data-deck-post-id={post.id}>
      {!cleanDeck && center ? <CreationDraftAction post={post} surface="deck" /> : null}
      <button type="button" className="deck-card-media" aria-label={center ? `Open ${title} in fullscreen` : `Bring ${title} to center`}
        data-ai-action={center ? 'clikb.feeds.deck.action.play' : undefined} disabled={center && loading}
        onClick={(event) => {
          if (Date.now() < suppressClickUntilRef.current) return;
          if (!center) {
            onSelectPost(Number(post.id));
            return;
          }
          if (cleanDeck) {
            const rect = event.currentTarget.getBoundingClientRect();
            const clickY = event.clientY - rect.top;
            if (clickY > rect.height * 0.65) {
              dispatch(setDeckCleanMode(false));
              return;
            }
          }
          playFromDeck();
        }}>
        {poster ? <DeckPoster key={poster} src={poster} /> : <div className="deck-card-placeholder" aria-hidden="true">{previewLabel(post).includes('Spatial') ? '◇' : '◈'}</div>}
        {center && videoSource ? <video key={activeId} ref={attachVideo} src={videoSource} poster={poster || undefined}
          className="deck-card-video" muted={muted} loop playsInline preload="metadata" aria-hidden="true"
          style={mediaFailed ? { display: 'none' } : undefined}
          onError={event => { if (videoRef.current !== event.currentTarget || !previewLifecycleRef.current?.isActive()) return; stopPreview(); setMediaFailed(true); }} /> : null}
        <span className="deck-kind-badge">{previewLabel(post)}</span>
        <span className="deck-card-shade" />
        <span className="deck-card-caption" data-deck-no-drag="true"
          onClick={e => {
            e.stopPropagation();
            if (Date.now() >= suppressClickUntilRef.current) {
              dispatch(setDeckCleanMode(true));
            }
          }}>
          <strong>{center && showNormalCues && (
            <span className={`deck-caption-zoom-cue${showZoomCue ? ' deck-caption-zoom-cue--visible' : ''}`} aria-hidden="true">
              <Icon kind="zoom-in" />
            </span>
          )}{title}</strong>
          <span className="deck-username" aria-hidden={canVisitCreator || undefined}
            style={canVisitCreator ? { visibility: 'hidden' } : undefined}>{username ? `@${username}` : 'ClikB creator'}</span>
        </span>
        {center && (!videoSource || mediaFailed) ? <span className="deck-open-hint"><Icon kind="play" /> Open experience</span> : null}
      </button>
      {center && showCleanCues && showMoreCue && <button type="button" className="deck-glass-button deck-more-cue"
        aria-label="More Deck controls" data-deck-no-drag="true" onClick={() => dispatch(setDeckCleanMode(false))}>More</button>}
      {canVisitCreator && <button type="button" className={`deck-creator${cleanDeck ? ' deck-creator--clean' : ''}`}
        data-deck-no-drag="true" data-ai-action="clikb.feeds.deck.action.creator_profile"
        aria-label={username ? `Visit @${username}` : 'Visit creator profile'} disabled={loading}
        onClick={event => {
          event.stopPropagation();
          if (Date.now() < suppressClickUntilRef.current) return;
          stopSlideshow(); stopPreview(); props.onVisitProfile?.(creatorId, Number(post.id));
        }}>{username ? `@${username}` : 'Creator'}</button>}
      {center && cleanDeck ? (
        <button
          type="button"
          className="deck-zoom-out deck-glass-button"
          data-deck-no-drag="true"
          aria-label="Restore deck view"
          onClick={e => {
            e.stopPropagation();
            dispatch(setDeckCleanMode(false));
          }}>
          <Icon kind="zoom-out" />
        </button>
      ) : null}
      {center && videoSource ? <button type="button" className="deck-mute deck-glass-button" data-deck-no-drag="true" data-ai-action="clikb.feeds.deck.action.toggle_mute"
        aria-label={muted ? 'Unmute preview' : 'Mute preview'} aria-pressed={!muted} onClick={() => dispatch(setPlaybackMuted(!muted))}><Icon kind={muted ? 'mute' : 'sound'} /></button> : null}
      {center && autoplayBlocked && !mediaFailed ? <button type="button" className="deck-preview-retry deck-glass-button" data-deck-no-drag="true"
        data-ai-action="clikb.feeds.deck.action.resume_preview" onClick={resumePreview}><Icon kind="play" /> Tap to preview</button> : null}
    </article>;
  };

  const renderSkeletonCard = (position: 'prev2' | 'prev' | 'active' | 'next' | 'next2') => (
    <article key={`skeleton.${position}`} className={`deck-card deck-card--${position} deck-card--skeleton`}>
      <div className="deck-skeleton-content">
        <div className="deck-skeleton-shimmer" />
        <span className="deck-kind-badge">{categoryLabel}</span>
        <div className="deck-skeleton-center">
          <span className="deck-skeleton-glyph">◈</span>
          <span className="deck-skeleton-label">Loading {categoryLabel}…</span>
        </div>
        <div className="deck-skeleton-bars">
          <div className="deck-skeleton-bar-title" />
          <div className="deck-skeleton-bar-sub" />
        </div>
      </div>
    </article>
  );

  return <section className={`deck-overlay${settings.darkMode ? ' deck-overlay--dark' : ''}${isMenuOpen ? ' deck-overlay--with-menu' : ''}${isBMenuOpen ? ' deck-overlay--with-bmenu' : ''}${props.composing ? ' deck-overlay--composing' : ''}${cleanDeck ? ' deck-overlay--clean' : ''}`}
    ref={overlayRef}
    style={{ '--deck-accent': settings.darkMode ? settings.appColorDark : settings.appColorLight } as CSSProperties}
    onClick={event => { if (event.target === event.currentTarget && Date.now() >= suppressClickUntilRef.current) closeDeck(); }}
    aria-label={`${categoryLabel} Deck`} data-deck-overlay="true">
    <div className="deck-scrim" onClick={() => { if (Date.now() >= suppressClickUntilRef.current) closeDeck(); }} aria-hidden="true" />
    <header className={`deck-topbar${props.search ? ' deck-topbar--search' : ''}`}>
      <div className="deck-category-wrap" ref={selectorRef}>
        <button type="button" className="deck-category deck-glass-button" data-ai-action="clikb.feeds.deck.action.select_category"
          aria-label={[slideshowActive ? `Slideshow running, ${categoryLabel}` : categoryLabel, profileLabel].filter(Boolean).join(', ')}
          aria-haspopup="menu" aria-expanded={categorySelectorOpen} onClick={() => { setSearchSelectorOpen(false); setCategorySelectorOpen(value => !value); }}>
          {profile ? <span className="deck-profile-avatar" aria-hidden="true">{profile.image
            ? <img src={profile.image} alt="" /> : profile.username.charAt(0).toUpperCase() || '◈'}</span>
            : <span className="deck-category-mark" aria-hidden="true">{slideshowActive ? <Icon kind="pause" /> : '◈'}</span>}
          <span className="deck-category-text"><span {...(slideshowActive ? { 'data-deck-slideshow-status': 'running' } : {})}>{slideshowActive ? 'Slideshow' : categoryLabel}</span>
            {profileLabel && <small>{profileLabel}</small>}</span>
          {slideshowActive ? <span className="deck-activity-dot" aria-hidden="true" /> : null}
          <Icon kind="chevron" /></button>
        {categorySelectorOpen ? <div className="deck-category-menu" role="menu" aria-label="Choose feed category">{DECK_CATEGORIES.map(item => <button key={item.id} type="button" role="menuitemradio" aria-checked={categorySelected(item.id)}
          data-ai-action={`clikb.feeds.deck.action.category.${item.id}`} disabled={categorySelected(item.id)} onClick={() => { stopPreview(); setCategorySelectorOpen(false); onCategory(item.id); }}><span>{item.label}</span><span aria-hidden="true">{categorySelected(item.id) ? '✓' : '›'}</span></button>)}
          <button type="button" role="menuitemcheckbox" className="deck-slideshow-option" aria-checked={slideshowActive} disabled={!slideshowActive && (loading || Boolean(error) || cards.length === 0)} data-ai-action="clikb.feeds.deck.action.toggle_slideshow" onClick={toggleSlideshow}>
            <span><Icon kind={slideshowActive ? 'pause' : 'play'} />{slideshowActive ? 'Pause Slideshow' : 'Slideshow'}</span><span aria-hidden="true">{slideshowActive ? 'On' : 'Off'}</span>
          </button>
        </div> : null}
      </div>
    {props.search ? <div className="deck-search-bar">
      <form className="deck-search-form" role="search" onSubmit={event => { event.preventDefault(); stopSlideshow(); stopPreview(); props.search?.onSearch(searchInput.trim()); }}>
        <input type="search" aria-label="Search ClikB" placeholder="Search ClikB" maxLength={500} data-ai-action="clikb.feeds.deck.action.search_text" value={searchInput} onChange={event => setSearchInput(event.target.value)} />
        <button type="submit" className="deck-glass-button" data-ai-action="clikb.feeds.deck.action.run_search" aria-label="Run search">Go</button>
      </form>
      <div className="deck-category-wrap deck-search-section" ref={searchSelectorRef}>
        <button type="button" className="deck-category deck-glass-button" data-ai-action="clikb.feeds.deck.action.select_search_section"
          aria-label={`Search collection: ${DECK_SEARCH_SECTIONS.find(section => section.id === props.search?.section)?.label}`}
          aria-haspopup="menu" aria-expanded={searchSelectorOpen} onClick={() => { setCategorySelectorOpen(false); setSearchSelectorOpen(value => !value); }}>
          {DECK_SEARCH_SECTIONS.find(section => section.id === props.search?.section)?.label}<Icon kind="chevron" />
        </button>
        {searchSelectorOpen ? <div className="deck-category-menu" role="menu" aria-label="Choose search collection">{DECK_SEARCH_SECTIONS.map(section => {
          const row = props.search?.collections?.find(row => row.section === section.id);
          return <button key={section.id} type="button" role="menuitemradio" aria-checked={section.id === props.search?.section} disabled={section.id === props.search?.section}
            data-ai-action={`clikb.feeds.deck.action.search_section.${section.id}`} onClick={() => { stopPreview(); setSearchSelectorOpen(false); props.search?.onSection(section.id); }}>
            <span>{section.label}{row ? <small className="deck-search-count">{row.status === 'loading' ? 'Loading…' : row.status === 'error' ? 'Unavailable' : `${row.loadedCount} loaded`}</small> : null}</span><span aria-hidden="true">{section.id === props.search?.section ? '✓' : '›'}</span>
          </button>;
        })}</div> : null}
      </div>
    </div> : null}
      {cleanDeck ? <div className="deck-top-concierge-host" ref={onDockHost} /> : null}
      <div className="deck-top-actions">

        <button type="button" className="deck-glass-button deck-pagination" data-ai-action="clikb.feeds.deck.action.paginate" disabled={!hasMore || loading}
          aria-label={loading ? 'Loading collection' : 'Load next collection'} title={hasMore ? 'Next collection' : 'No more posts'} onClick={onPaginate}><Icon kind="pages" /><span>Next collection</span></button>
        <button type="button" className="deck-glass-button deck-close" data-ai-action="clikb.feeds.deck.action.close" aria-label={props.composing ? 'Show grid behind creation' : 'Close Deck to grid'} onClick={closeDeck}><Icon kind="close" /></button>
      </div>
    </header>
    {showCleanCues && showCloseCue && (['left', 'right'] as const).map(position => (
      <button key={position} type="button" className={`deck-close-cue deck-close-cue--${position}`}
        aria-label="Close Deck to Grid" data-deck-no-drag="true" onClick={closeDeck}>
        <span className="deck-close-cue-pill">
          <span aria-hidden="true">✦</span> close <span aria-hidden="true">✦</span>
        </span>
      </button>
    ))}
    <main key={modeKey} {...(props.composing ? { inert: '' } as Record<string, string> : {})} className={`deck-stage${arrivalDirection ? ` deck-stage--arrive-${arrivalDirection > 0 ? 'next' : 'prev'}` : ''}`} ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture} onDragStart={event => event.preventDefault()}
      onClick={event => { if (event.target === event.currentTarget && Date.now() >= suppressClickUntilRef.current) closeDeck(); }}>
      <div className="deck-orbit" aria-hidden="true" />
      {cards.length >= 3 ? (
        <button
          type="button"
          className="deck-card-count-toggle"
          data-deck-no-drag="true"
          data-ai-action="clikb.feeds.deck.action.toggle_card_count"
          aria-label={`Deck view: showing ${deckCardCount} cards. Click to show ${deckCardCount === 3 ? 4 : deckCardCount === 4 ? 5 : 3} cards.`}
          onClick={(e) => {
            e.stopPropagation();
            const nextCount: 3 | 4 | 5 = deckCardCount === 3 ? 4 : deckCardCount === 4 ? 5 : 3;
            dispatch(setDeckCardCount(nextCount));
          }}
        >
          <span className="deck-card-count-indicator">{deckCardCount}</span>
          <span className="deck-card-count-label">Cards</span>
        </button>
      ) : null}
      {active ? (
        <>
          {deckCardCount === 5 && cards.length > 4 ? renderCard(cards[(activeIndex - 2 + cards.length) % cards.length], 'prev2') : null}
          {cards.length > 1 ? renderCard(cards[(activeIndex - 1 + cards.length) % cards.length], 'prev') : null}
          {cards.length > 2 ? renderCard(cards[(activeIndex + 1) % cards.length], 'next') : null}
          {deckCardCount >= 4 && cards.length > 3 ? renderCard(cards[(activeIndex + 2) % cards.length], 'next2') : null}
          {renderCard(active, 'active')}
        </>
      ) : loading ? (
        <>
          {deckCardCount === 5 ? renderSkeletonCard('prev2') : null}
          {renderSkeletonCard('prev')}
          {renderSkeletonCard('next')}
          {deckCardCount >= 4 ? renderSkeletonCard('next2') : null}
          {renderSkeletonCard('active')}
        </>
      ) : (
        <div className="deck-empty" role="status">
          <span className="deck-empty-mark">◈</span>
          <strong>{error ? 'This collection could not load' : 'Your next story starts here'}</strong>
          <p>{error ? 'Try Next collection to load again.' : 'There are no posts in this collection yet.'}</p>
        </div>
      )}
      <button type="button" className="deck-arrow deck-arrow--prev deck-glass-button" data-deck-no-drag="true" data-ai-action="clikb.feeds.deck.action.cycle_prev" disabled={cards.length < 2 || loading}
        aria-label="Previous card" onClick={() => cycle(-1)}><Icon kind="prev" /></button>
      <button type="button" className="deck-arrow deck-arrow--next deck-glass-button" data-deck-no-drag="true" data-ai-action="clikb.feeds.deck.action.cycle_next" disabled={cards.length < 2 || loading}
        aria-label="Next card" onClick={() => cycle(1)}><Icon kind="next" /></button>
    </main>
    {showCleanCues && showCloseCue && <button type="button" className="deck-close-cue deck-close-cue--bottom"
      aria-label="Close Deck to Grid" data-deck-no-drag="true" onClick={closeDeck}>
      <span className="deck-close-cue-pill">
        <span aria-hidden="true">✦</span> close <span aria-hidden="true">✦</span>
      </span>
    </button>}
    <div className="deck-collection">
      <div className="deck-positions" aria-label="Cards in current collection">{cards.map((post, position) => <button key={Number(post.id)} type="button" className={`deck-position${position === activeIndex ? ' deck-position--active' : ''}`}
        data-ai-action={`clikb.feeds.deck.action.jump_to.${post.id}`} aria-label={`Show card ${position + 1}: ${deckPostTitle(post)}`} aria-current={position === activeIndex ? 'true' : undefined}
        title={deckPostTitle(post)} disabled={position === activeIndex || loading} onClick={() => onSelectPost(Number(post.id))}><span>{position + 1}</span></button>)}</div>
      <span className="deck-count" aria-live="polite">{cards.length ? `${activeIndex + 1} / ${cards.length}` : categoryLabel}{loading ? ' · Loading…' : ''}</span>
      {error && cards.length ? <span className="deck-error" role="status">Collection could not load. Try again.</span> : null}
    </div>
    <footer className={`deck-dock${settings.autoControlEnabled ? ' deck-dock--concierge-on' : ' deck-dock--concierge-off'}${isBMenuOpen ? ' deck-dock--bmenu' : ''}`}>
      <div className="deck-circle-host" data-deck-circle-host="true" data-ai-snapshot-ignore="true" />
      {!cleanDeck ? <div className="deck-concierge-host" data-deck-concierge-host="true" ref={onDockHost} /> : null}
      {!cleanDeck ? (
        <button type="button" className="deck-create deck-glass-button" data-ai-action="clikb.feeds.deck.action.open_create" onClick={createFromDeck}><Icon kind="add" /><span>Create</span></button>
      ) : null}
      <div className="deck-control-host" data-deck-control-host="true" />
    </footer>
    {cleanDeck ? (
      <>
        {!props.composing ? (
          <button
            type="button"
            className="deck-clean-create deck-glass-button"
            data-ai-action="clikb.feeds.deck.action.open_create"
            onClick={createFromDeck}
            aria-label="Create"
            title="Create"
          >
            <Icon kind="add" />
          </button>
        ) : null}
        {!props.composing ? (
          <div className="deck-clean-control">
            <AutoControlPill placement="embedded" />
          </div>
        ) : null}
      </>
    ) : null}
    <button
      type="button"
      className="deck-ai-toggle-clean-mode"
      data-ai-action="clikb.feeds.deck.action.toggle_clean_mode"
      data-deck-no-drag="true"
      aria-label={cleanDeck ? 'Switch off Clean Deck mode' : 'Switch on Clean Deck mode'}
      onClick={() => dispatch(setDeckCleanMode(!cleanDeck))}
      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }}
      tabIndex={-1}
    />
  </section>;
}
