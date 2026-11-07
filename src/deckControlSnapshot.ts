import { boundedFeedTextHint, formatFeedPostControlLabel, summariseVisiblePost, type FeedAreaSnapshot, type FeedControl, type VisiblePost } from './feedsControlSnapshot';
import { postVideoSource } from './postVideoSource';

export const DECK_PAGE_SIZE = 28;
export const DECK_AREA_ID = 'clikb.feeds.deck' as const;
export type DeckCategory = 'all' | 'games' | 'shorts' | 'cinema' | 'page' | 'search';
export type DeckSearchSection = 'games' | 'shorts' | 'cinema';
export type DeckSearchCollection = { section: DeckSearchSection; loadedCount: number; status: 'loading' | 'ready' | 'empty' | 'error'; hasMore: boolean };
export const DECK_SEARCH_SECTIONS: Array<{ id: DeckSearchSection; label: string; feedType: number }> = [
  { id: 'games', label: 'Games', feedType: 3 }, { id: 'shorts', label: 'Shorts', feedType: 1 },
  { id: 'cinema', label: 'Cinema', feedType: 2 },
];
export type DeckPost = Record<string, unknown>;
/** Every row is summarized independently of the row currently displayed in Deck. */
export function deckSearchCollections(query: string, areas: Record<string, FeedAreaSnapshot>): DeckSearchCollection[] {
  return DECK_SEARCH_SECTIONS.map(({ id }) => {
    const state = areas[`clikb.feeds.context.search.${id}`]?.state;
    const current = state?.route === '/search' && state?.query === query.slice(0, 500);
    return { section: id, loadedCount: current ? Number(state.loadedCount) || 0 : 0,
      status: current && ['ready', 'empty', 'error'].includes(String(state.status)) ? state.status as DeckSearchCollection['status'] : 'loading',
      hasMore: current ? state.hasMore === true : true };
  });
}
export const DECK_CATEGORIES: Array<{ id: DeckCategory; label: string }> = [
  { id: 'all', label: 'All Feeds' }, { id: 'games', label: 'Games' },
  { id: 'shorts', label: 'Shorts' }, { id: 'cinema', label: 'Cinema' }, { id: 'search', label: 'Search' }, { id: 'page', label: 'My Page' },
];

/** Preserve the supplied page order and post identity, without touching the full feeds array. */
export const normaliseDeckCards = (cards: DeckPost[]): DeckPost[] => {
  const seen = new Set<number>();
  return cards.filter(post => {
    const id = Number(post.id);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, DECK_PAGE_SIZE);
};

const meaningful = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') return !['', '0', 'null', 'undefined', '{}', '[]'].includes(value.trim().toLowerCase());
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === true;
};
export const deckPreviewKind = (post: DeckPost): 'spatial' | 'game' | 'touch' | 'video' | 'image' => {
  if (post.interactionFormat === 'spatial-v1' || meaningful(post.spatialExperienceJson)) return 'spatial';
  if (Number(post.mode) === 2) return 'game';
  // Modern touch graphs and the older swipe/touch columns all belong to the fullscreen player.
  if (['touchConfigJson', 'main', 'inttype', 'mainint', 'int1', 'int2', 'subl', 'subr',
    'touchl', 'touchr', 'touchlx', 'touchly', 'touchrx', 'touchry'].some(key => meaningful(post[key]))) return 'touch';
  return deckVideoSource(post) ? 'video' : 'image';
};

export const deckVideoSource = (post: DeckPost): string =>
  postVideoSource(post);
export const deckPosterSource = (post: DeckPost): string =>
  [post.x1, post.item1, post.poster, post.thumbnail].find((value): value is string => typeof value === 'string' && Boolean(value.trim())) || '';
export const deckPostTitle = (post: DeckPost): string => boundedFeedTextHint(post.finalTitle || post.caption, 80) || `Post ${post.id}`;
export const deckActiveIndex = (cards: DeckPost[], postId: number | null): number => {
  if (!cards.length) return -1;
  const found = cards.findIndex(post => Number(post.id) === postId);
  return found < 0 ? 0 : found;
};
export const deckNeighbourIndexes = (length: number, active: number): number[] => {
  if (!length || active < 0) return [];
  return [...new Set([active, (active - 1 + length) % length, (active + 1) % length])];
};
const summary = (post: DeckPost): VisiblePost | null => {
  const item = summariseVisiblePost(post);
  if (!item) return null;
  const kind = deckPreviewKind(post);
  return { ...item, capabilities: { ...item.capabilities, hotspot: kind === 'game' || kind === 'touch', spatial: kind === 'spatial' } };
};

export type DeckSnapshotInput = {
  cards: DeckPost[]; activePostId: number | null; category: DeckCategory;
  profileOwnerId?: number; profileUsername?: string; pageIsOwn?: boolean;
  creatorProfileAvailable?: boolean;
  loading: boolean; hasMore: boolean; error: string | null; muted: boolean;
  autoControlEnabled: boolean; categorySelectorOpen: boolean; mediaPlaying: boolean;
  autoplayBlocked: boolean;
  slideshowActive?: boolean;
  composing?: boolean;
  cleanMode?: boolean;
  search?: { section: DeckSearchSection; query: string; input: string; selectorOpen: boolean; requestId?: string; collections?: DeckSearchCollection[] };
  cardVisibility?: Array<{ postId: number; visiblePercent: number; fullyVisible: boolean; occluded: boolean }>;
};

/** Semantic context is permission scoped; only the three rendered cards are described when off. */
export const buildDeckSnapshot = (input: DeckSnapshotInput): FeedAreaSnapshot => {
  const cards = normaliseDeckCards(input.cards);
  const index = deckActiveIndex(cards, input.activePostId);
  const activePostId = index >= 0 ? Number(cards[index].id) : null;
  const visibleIndexes = deckNeighbourIndexes(cards.length, index);
  const video = index >= 0 && deckPreviewKind(cards[index]) === 'video';
  const creatorId = index >= 0 ? Number(cards[index].sender) : 0;
  const creatorUsername = index >= 0 && typeof cards[index].username === 'string' ? String(cards[index].username).replace(/^@/, '').slice(0, 48) : '';
  const control = (name: string, enabled: boolean, handlerRef: string, targetId?: number | string, label?: string): FeedControl => ({
    controlId: `${DECK_AREA_ID}.control.${name}`, areaId: DECK_AREA_ID,
    candidateActionId: `${DECK_AREA_ID}.action.${name}`, enabled, aiPolicy: 'candidate', handlerRef,
    ...(label ? { label } : {}),
    ...(targetId != null ? { targetId } : {}),
  });
  const visibleControls = [
    control('select_category', true, 'DeckOverlay.toggleCategorySelector'),
    control('cycle_next', cards.length > 1 && !input.loading, 'DeckOverlay.cycleNext'),
    control('cycle_prev', cards.length > 1 && !input.loading, 'DeckOverlay.cyclePrev'),
    control('play', activePostId != null && !input.loading, 'DeckOverlay.playActive', activePostId ?? undefined, index >= 0 ? formatFeedPostControlLabel(cards[index], 120) : undefined),
    ...(input.creatorProfileAvailable && Number.isSafeInteger(creatorId) && creatorId > 0 ? [control('creator_profile', !input.loading,
      'DeckOverlay.visitCreator', creatorId, creatorUsername ? `Visit @${creatorUsername}` : 'Visit creator profile')] : []),
    control('paginate', input.hasMore && !input.loading, 'DeckOverlay.paginate'),
    control('open_create', true, 'DeckOverlay.openCreate'),
    control('toggle_mute', video, 'DeckOverlay.toggleMute'),
    control('toggle_clean_mode', true, 'DeckOverlay.toggleCleanMode', undefined, Boolean(input.cleanMode) ? 'Switch off Clean Deck mode' : 'Switch on Clean Deck mode'),
    control('close', true, 'DeckOverlay.close'),
    ...(input.autoplayBlocked && video ? [control('resume_preview', true, 'DeckOverlay.resumePreview')] : []),
    ...cards.map((post, position) => control(`jump_to.${post.id}`, position !== index && !input.loading, 'DeckOverlay.jumpToCard', Number(post.id), formatFeedPostControlLabel(post, 120))),
    ...(input.categorySelectorOpen ? DECK_CATEGORIES.map(category => control(`category.${category.id}`,
      category.id !== input.category || (category.id === 'page' && input.pageIsOwn === false), 'DeckOverlay.selectCategory', category.id)) : []),
    ...(input.categorySelectorOpen ? [control('toggle_slideshow', Boolean(input.slideshowActive) || (!input.loading && !input.error && cards.length > 0), 'DeckOverlay.toggleSlideshow')] : []),
    ...(input.search ? [{ ...control('search_text', true, 'DeckOverlay.setSearchInput'), kind: 'text' as const },
      control('select_search_section', true, 'DeckOverlay.toggleSearchSection'),
      control('run_search', true, 'DeckOverlay.submitSearch'),
      ...(input.search.selectorOpen ? DECK_SEARCH_SECTIONS.map(section => control(`search_section.${section.id}`,
        section.id !== input.search?.section, 'DeckOverlay.selectSearchSection', section.id)) : [])] : []),
  ];
  return {
    areaId: DECK_AREA_ID, source: 'DeckOverlay', instanceId: 'deck.primary',
    state: {
      isOpen: true, category: input.category, activeCategory: input.category,
      ...(input.category === 'page' && input.profileOwnerId ? { profileOwnerId: input.profileOwnerId,
        profileUsername: (input.profileUsername || '').slice(0, 48), pageIsOwn: input.pageIsOwn !== false } : {}),
      deckEnabled: true, cleanMode: input.cleanMode !== false,
      creationBackdrop: Boolean(input.composing),
      horizontalNavigation: !input.composing, verticalNavigation: !input.composing,
      verticalScope: input.search ? 'search_collections' : ['all','games','shorts','cinema'].includes(input.category) ? 'feed_categories' : 'none',
      activePostId, postId: activePostId, activeCardIndex: index,
      activeCreatorId: Number.isSafeInteger(creatorId) && creatorId > 0 ? creatorId : null, activeCreatorUsername: creatorUsername,
      totalCardsInBatch: cards.length, collectionPostIds: cards.map(post => Number(post.id)).join(','),
      collectionKey: `${input.category}:${input.search ? `${input.search.section}:${input.search.query}:` : ''}${cards.map(post => Number(post.id)).join(',')}`,
      ...(input.search ? { searchSection: input.search.section, searchQuery: input.search.query.slice(0, 500),
        searchInput: input.search.input.slice(0, 500), searchSelectorOpen: input.search.selectorOpen, searchRequestId: input.search.requestId || '',
        searchCollectionSections: (input.search.collections || []).map(row => row.section).join(','),
        ...Object.fromEntries((input.search.collections || []).flatMap(row => {
          const key = `search${row.section[0].toUpperCase()}${row.section.slice(1)}`;
          return [[`${key}LoadedCount`, row.loadedCount], [`${key}Status`, row.status], [`${key}HasMore`, row.hasMore]];
        })),
      } : {}),
      isMuted: input.muted, muted: input.muted, hasMore: input.hasMore, loading: input.loading,
      status: input.error ? 'error' : input.loading ? 'loading' : cards.length ? 'ready' : 'empty',
      categorySelectorOpen: input.categorySelectorOpen, selectorOpen: input.categorySelectorOpen,
      contextScope: input.composing ? 'creation_backdrop' : input.autoControlEnabled ? 'current_collection' : 'active_and_neighbors',
      contextPostCount: input.composing ? 0 : input.autoControlEnabled ? cards.length : visibleIndexes.length,
      fullCollectionContextAvailable: input.autoControlEnabled && !input.composing,
      mediaPlaying: input.mediaPlaying, autoplayBlocked: input.autoplayBlocked,
      slideshowActive: Boolean(input.slideshowActive),
    },
    visiblePosts: input.composing ? [] : visibleIndexes.map(position => summary(cards[position])).filter((post): post is VisiblePost => Boolean(post)),
    visiblePostRefs: input.composing ? [] : visibleIndexes.flatMap(position => {
      const visibility = input.cardVisibility?.find(item => item.postId === Number(cards[position].id));
      return visibility && visibility.visiblePercent > 0 ? [{ ...visibility, labelHint: deckPostTitle(cards[position]).slice(0, 48) }] : [];
    }),
    ...(input.autoControlEnabled && !input.composing ? { collectionPosts: cards.map(summary).filter((post): post is VisiblePost => Boolean(post)) } : {}),
    visibleControls: input.composing ? visibleControls.filter(control => ['close','select_category','paginate'].includes(control.candidateActionId?.split('.action.')[1] || '') || control.candidateActionId?.startsWith(`${DECK_AREA_ID}.action.category.`)) : visibleControls,
  };
};
