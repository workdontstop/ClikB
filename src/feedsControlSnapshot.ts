/** One bounded live contract for every shared feed instance. */
export const FEEDS_SURFACE_ID = 'clikb.feeds';
export const FEEDS_SURFACE_TITLE = 'ClikB Feeds and Content';
export const FEEDS_RAG_DOC_ID = 'clikb_feeds';
export const FEEDS_SCHEMA_VERSION = 1;
export const FEEDS_MAX_VISIBLE_CARDS = 6;
export const FEEDS_MAX_VISIBLE_REFS = 18;
export const FEEDS_MAX_SNAPSHOT_CHARS = 60000;

export type FeedMode = 'shorts' | 'cinema' | 'games' | 'mixed' | 'profile' | 'search';
export type FeedEntryKind = 'feed' | 'shared_link';
export type FeedAreaId = `clikb.feeds.${string}`;
export type FeedControl = {
  kind?: 'click' | 'text';
  controlId: string;
  areaId: FeedAreaId;
  handlerRef: string;
  label?: string;
  enabled: boolean;
  aiPolicy: 'candidate' | 'scroll' | 'manual_only' | 'needs_confirmation' | 'needs_handoff';
  candidateActionId?: string;
  targetId?: string | number;
  disabledReason?: string;
};
export type VisiblePost = {
  postId: number;
  contentKind: 'short' | 'cinema' | 'game' | 'unknown';
  creator: { id: number | null; username: string };
  metadata: {
    status: 'available' | 'unavailable';
    title?: string;
    overviewHint?: string;
    captionHint?: string;
    promptHint?: string;
    categories: string[];
    tags: string[];
    legacyCaptionHint?: string;
  };
  capabilities: { fullscreen: boolean; hotspot: boolean; spatial: boolean; video: boolean };
};
export type FeedAreaSnapshot = {
  areaId: FeedAreaId;
  source: string;
  instanceId: string;
  state: Record<string, string | number | boolean | null>;
  visiblePosts: VisiblePost[];
  /** Deck's current bounded collection; supplied only while Auto Control is on. */
  collectionPosts?: VisiblePost[];
  /** Compact identity for all intersecting cards, beyond the six rich summaries. */
  visiblePostRefs?: Array<{ postId: number; labelHint: string; visiblePercent: number; fullyVisible: boolean; occluded: boolean }>;
  visibleControls: FeedControl[];
};
export type FeedsControlSnapshot = {
  surfaceId: typeof FEEDS_SURFACE_ID;
  surfaceTitle: typeof FEEDS_SURFACE_TITLE;
  ragDocId: typeof FEEDS_RAG_DOC_ID;
  schemaVersion: typeof FEEDS_SCHEMA_VERSION;
  stateVersion: number;
  route: string;
  activeAreaIds: FeedAreaId[];
  areas: Record<string, FeedAreaSnapshot>;
  visibleControls: FeedControl[];
  availableActions: Array<{ actionId: string; controlId: string; label?: string; kind?: 'click' | 'text'; targetId?: string | number; requiresConfirmation?: boolean }>;
};

export const feedMode = (type: number, vertical: boolean): FeedMode =>
  !vertical ? 'search' : type === 1 ? 'shorts' : type === 2 ? 'cinema' : type === 3 ? 'games' : type === 10 ? 'profile' : 'mixed';

export const feedDisplayName = (type: number, vertical: boolean, entryKind: FeedEntryKind = 'feed'): string => {
  if (entryKind === 'shared_link') return 'Shared post';
  const section = type === 1 ? 'Shorts' : type === 2 ? 'Cinema' : type === 3 ? 'Games' : '';
  if (!vertical) return section ? `Search ${section}` : 'Search feeds';
  return section || (type === 10 ? 'Profile posts' : 'All Feeds');
};

export const feedInstanceId = (type: number, vertical: boolean): string =>
  vertical ? `${feedMode(type, true)}.primary` : `search.${type === 3 ? 'games' : type === 1 ? 'shorts' : 'cinema'}`;

export const emptyFeedsSnapshot = (): FeedsControlSnapshot => ({
  surfaceId: FEEDS_SURFACE_ID, surfaceTitle: FEEDS_SURFACE_TITLE, ragDocId: FEEDS_RAG_DOC_ID,
  schemaVersion: FEEDS_SCHEMA_VERSION, stateVersion: 0, route: '/', activeAreaIds: [], areas: {},
  visibleControls: [], availableActions: [],
});

const hint = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/https?:\/\/\S+/gi, '[link]').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
/** Shared strict text bound for overlays; callers must still select only visible content. */
export const boundedFeedTextHint = (value: unknown, limit = 120): string => hint(value, Math.max(0, Math.min(limit, 160)));
const labels = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return values.slice(0, 4).map(item => hint(item, 32)).filter(Boolean);
};

export const formatFeedPostControlLabel = (post: Record<string, unknown>, maxLen = 120): string => {
  const limit = Math.max(24, Math.min(maxLen, 140));
  const title = hint(post.finalTitle, 64);
  const creator = hint(post.username, 32).replace(/^@/, '');
  const snippet = hint(post.prompt || post.finalOverview || post.caption, 96);
  const head = title && creator
    ? `${title} (@${creator})`
    : title || (creator ? `@${creator}` : `Post ${String(post.id ?? '').trim()}`.trim());
  if (snippet && snippet.toLowerCase() !== title.toLowerCase()) {
    return `${head} — ${snippet}`.slice(0, limit);
  }
  return head.slice(0, limit);
};

/** Allowlist only. Never spread a post object into the conversation snapshot. */
export const summariseVisiblePost = (post: Record<string, unknown>): VisiblePost | null => {
  const postId = Number(post.id);
  if (!Number.isSafeInteger(postId) || postId <= 0) return null;
  const creatorId = Number(post.sender);
  const mode = Number(post.mode);
  const spatial = post.interactionFormat === 'spatial-v1';
  const hotspot = mode === 2 && !spatial && Boolean(post.touchConfigJson || post.main || post.inttype);
  const title = hint(post.finalTitle, 80);
  const overviewHint = hint(post.finalOverview, 160);
  const captionHint = hint(post.caption, 140);
  const promptHint = hint(post.prompt, 140);
  const categories = labels(post.categories);
  const tags = labels(post.tags);
  const modern = Boolean(title || overviewHint || captionHint || promptHint || categories.length || tags.length);
  const legacyCaptionHint = (title || overviewHint || categories.length || tags.length) ? '' : hint(post.caption, 120);
  return {
    postId,
    contentKind: mode === 2 ? 'game' : mode === 1 ? 'cinema' : mode === 0 ? 'short' : 'unknown',
    creator: { id: Number.isSafeInteger(creatorId) && creatorId > 0 ? creatorId : null, username: hint(post.username, 48) },
    metadata: {
      status: modern ? 'available' : 'unavailable',
      ...(title ? { title } : {}), ...(overviewHint ? { overviewHint } : {}),
      ...(captionHint ? { captionHint } : {}), ...(promptHint ? { promptHint } : {}),
      categories, tags, ...(legacyCaptionHint ? { legacyCaptionHint } : {}),
    },
    capabilities: { fullscreen: true, hotspot, spatial, video: Boolean(post.videoUrl || post.main || post.xv1) },
  };
};

export const summariseVisiblePosts = (posts: Record<string, unknown>[], visibleIds: Array<number | string>): VisiblePost[] => {
  const byId = new Map(posts.map(post => [String(post.id), post]));
  return visibleIds.slice(0, FEEDS_MAX_VISIBLE_CARDS).map(id => byId.get(String(id))).filter((post): post is Record<string, unknown> => Boolean(post))
    .map(summariseVisiblePost).filter((post): post is VisiblePost => post !== null);
};

export type FeedVisibleCard = { id: string; visiblePercent: number; fullyVisible: boolean; occluded: boolean };
type Bounds = { top: number; bottom: number; left: number; right: number };

/** Search strips deliberately stop short of the browser's physical scroll ends. */
export const horizontalFeedScrollBounds = (range: number, mobile: boolean) => {
  const physicalMax = Math.max(0, range);
  if (physicalMax <= 1) return { min: 0, max: 0 };
  const min = Math.min(physicalMax, Math.max(physicalMax * (mobile ? 0.01 : 0.03), mobile ? 5 : 20));
  return { min, max: Math.max(min, physicalMax * 0.99) };
};

export const feedScrollAvailability = (offset: number, maxOffset: number, vertical: boolean, mobile: boolean) => {
  const { min, max } = vertical ? { min: 0, max: Math.max(0, maxOffset) } : horizontalFeedScrollBounds(maxOffset, mobile);
  const canScrollBackward = offset > min + 2;
  const canScrollForward = offset < max - 2;
  return { canScrollBackward, canScrollForward,
    region: max - min <= 2 ? 'all' : !canScrollBackward ? 'start' : !canScrollForward ? 'end' : 'middle' };
};

export const measureFeedCardVisibility = (rect: Bounds, viewport: Bounds): Pick<FeedVisibleCard, 'visiblePercent' | 'fullyVisible'> => {
  const width = Math.max(0, rect.right - rect.left);
  const height = Math.max(0, rect.bottom - rect.top);
  const area = width * height;
  const intersectionWidth = Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left));
  const intersectionHeight = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
  const fraction = area > 0 ? (intersectionWidth * intersectionHeight) / area : 0;
  const fullyVisible = fraction >= 0.999999;
  return { visiblePercent: fraction > 0 ? (fullyVisible ? 100 : Math.max(1, Math.min(99, Math.round(fraction * 100)))) : 0,
    fullyVisible };
};

/** A floating Guide or modal can cover a geometrically visible card. */
export const applyFeedCardOcclusion = (
  geometry: Pick<FeedVisibleCard, 'visiblePercent' | 'fullyVisible'>,
  unobstructedSamples: number,
  sampleCount: number,
): Pick<FeedVisibleCard, 'visiblePercent' | 'fullyVisible' | 'occluded'> => {
  const count = Math.max(1, sampleCount);
  const visibleShare = Math.max(0, Math.min(count, unobstructedSamples)) / count;
  return {
    visiblePercent: geometry.visiblePercent > 0 && visibleShare > 0
      ? Math.max(1, Math.round(geometry.visiblePercent * visibleShare)) : 0,
    fullyVisible: geometry.fullyVisible && visibleShare === 1,
    occluded: visibleShare < 1,
  };
};

/** Prefer wholly seen cards for the six detailed summaries; preserve on-screen order on ties. */
export const detailedVisibleIds = (cards: FeedVisibleCard[]): string[] => cards
  .map((card, order) => ({ card, order }))
  .sort((a, b) => Number(b.card.fullyVisible) - Number(a.card.fullyVisible)
    || b.card.visiblePercent - a.card.visiblePercent || a.order - b.order)
  .slice(0, FEEDS_MAX_VISIBLE_CARDS).map(item => item.card.id);

export const summariseVisiblePostRefs = (posts: Record<string, unknown>[], cards: FeedVisibleCard[]) => {
  const byId = new Map(posts.map(post => [String(post.id), post]));
  return cards.slice(0, FEEDS_MAX_VISIBLE_REFS).flatMap(card => {
    const post = byId.get(card.id);
    if (!post) return [];
    const postId = Number(post.id);
    if (!Number.isSafeInteger(postId) || postId <= 0) return [];
    return [{ postId, labelHint: formatFeedPostControlLabel(post, 120),
      visiblePercent: card.visiblePercent, fullyVisible: card.fullyVisible, occluded: card.occluded }];
  });
};

export const assembleFeedsSnapshot = (
  current: FeedsControlSnapshot,
  route?: string,
  area?: FeedAreaSnapshot,
  removeAreaId?: FeedAreaId,
): FeedsControlSnapshot => {
  const areas = { ...current.areas };
  if (removeAreaId) delete areas[removeAreaId];
  if (area) areas[area.areaId] = area;
  const activeAreaIds = Object.keys(areas) as FeedAreaId[];
  const visibleControls = activeAreaIds.flatMap(id => areas[id].visibleControls);
  const contextRoute = area?.areaId.startsWith('clikb.feeds.context.') && typeof area.state.route === 'string'
    ? area.state.route : undefined;
  const next = {
    ...current, route: route ?? contextRoute ?? current.route, areas, activeAreaIds, visibleControls,
    availableActions: current.availableActions.filter(action => visibleControls.some(control =>
      control.controlId === action.controlId && control.candidateActionId === action.actionId && control.enabled)),
  };
  if (JSON.stringify(next).length > FEEDS_MAX_SNAPSHOT_CHARS) throw new Error('Feeds snapshot exceeds bounded contract');
  return JSON.stringify(next) === JSON.stringify(current) ? current : { ...next, stateVersion: current.stateVersion + 1 };
};
