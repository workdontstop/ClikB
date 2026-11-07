const DECK_AREA_ID = 'clikb.feeds.deck';
/** Text control is deliberately scoped to the search draft, never post/comment fields. */
export const isFeedsTextAction = (actionId: string): boolean => actionId === `${DECK_AREA_ID}.action.search_text`;

/** Deck has its own operational packet while remaining part of the Feeds surface. */
export function activeFeedRagDocIds(feeds: any): string[] {
  if (feeds?.surfaceId !== 'clikb.feeds' || feeds?.ragDocId !== 'clikb_feeds'
      || !Array.isArray(feeds.activeAreaIds) || !feeds.activeAreaIds.length) return [];
  return ['clikb_feeds', ...(feeds.activeAreaIds.includes(DECK_AREA_ID)
    && feeds.areas?.[DECK_AREA_ID]?.state?.isOpen === true ? ['clikb_deck'] : [])];
}

const deckText = (value: unknown, limit: number): string => typeof value === 'string'
  ? value.replace(/https?:\/\/\S+/gi, '[link]').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
const deckLabels = (value: unknown): string[] => Array.isArray(value)
  ? value.slice(0, 4).map(item => deckText(item, 32)).filter(Boolean) : [];

/** Defend the one optional collection context at the server boundary as well as in the UI. */
export function feedsConversationSnapshot(feeds: any, autoControlEnabled: boolean): any {
  const deck = feeds?.areas?.[DECK_AREA_ID];
  if (!deck) return feeds;
  const { collectionPosts: rawCollection, ...boundedDeck } = deck;
  const seen = new Set<number>();
  const collectionPosts = autoControlEnabled && Array.isArray(rawCollection)
    ? rawCollection.slice(0, 28).flatMap((post: any) => {
      const postId = Number(post?.postId);
      if (!Number.isSafeInteger(postId) || postId <= 0 || seen.has(postId)) return [];
      seen.add(postId);
      const creatorId = Number(post?.creator?.id);
      const title = deckText(post?.metadata?.title, 80);
      const overviewHint = deckText(post?.metadata?.overviewHint, 160);
      const captionHint = deckText(post?.metadata?.captionHint, 140);
      const promptHint = deckText(post?.metadata?.promptHint, 140);
      const legacyCaptionHint = deckText(post?.metadata?.legacyCaptionHint, 120);
      return [{
        postId,
        contentKind: ['short', 'cinema', 'game'].includes(post?.contentKind) ? post.contentKind : 'unknown',
        creator: { id: Number.isSafeInteger(creatorId) && creatorId > 0 ? creatorId : null,
          username: deckText(post?.creator?.username, 48) },
        metadata: { status: post?.metadata?.status === 'available' ? 'available' : 'unavailable',
          ...(title ? { title } : {}), ...(overviewHint ? { overviewHint } : {}),
          ...(captionHint ? { captionHint } : {}), ...(promptHint ? { promptHint } : {}),
          categories: deckLabels(post?.metadata?.categories), tags: deckLabels(post?.metadata?.tags),
          ...(legacyCaptionHint ? { legacyCaptionHint } : {}) },
        capabilities: Object.fromEntries(['fullscreen', 'hotspot', 'spatial', 'video']
          .map(key => [key, post?.capabilities?.[key] === true])),
      }];
    }) : null;
  return { ...feeds, areas: { ...feeds.areas, [DECK_AREA_ID]: {
    ...boundedDeck, ...(collectionPosts ? { collectionPosts } : {}),
  } } };
}

/** Pure shared browser/server contract: approve a target, not every telemetry tick. */
export function feedsExecutionContext(feeds: any, operationId: string): string {
  if (!feeds) return '';
  const scroll = operationId.includes(':');
  const action = scroll ? null : feeds.availableActions?.find((a: any) => a.actionId === operationId);
  const control = scroll ? null : feeds.visibleControls?.find((c: any) => c.candidateActionId === operationId);
  const areaId = scroll ? operationId.split(':')[0] : control?.areaId;
  const owner = feeds.areas?.[areaId];
  if (!owner || (!scroll && (!action || !control?.enabled))) return '';
  const volatile = new Set(['loadedCount', 'likeCount', 'mediaPlaying', 'playing', 'closeInteractionArmed',
    'settledAt', 'isScrolling', 'visibleCount', 'measuredAt', 'updatedAt']);
  if (!/\.(expand_caption|collapse_caption)$/.test(operationId)) {
    volatile.add('captionHidden');
  }
  if (!scroll) {
    for (const key of ['scrollTop', 'scrollMax', 'scrollRegion', 'sceneScrollLeft', 'sceneScrollMax', 'captionScrollTop', 'captionScrollMax']) {
      volatile.add(key);
    }
  }
  const state = Object.fromEntries(Object.entries(owner.state || {}).filter(([key]) =>
    !volatile.has(key) && !/^(currentTime|currentSecond|duration|durationSeconds|progress|buffered|playbackTime)$/.test(key)).sort(([a], [b]) => a.localeCompare(b)));
  // Playback state matters only to an actual playback command, not Like/Back/scroll/Deck-open.
  if (/\.(toggle_play_pause|resume_preview)$/.test(operationId)) {
    state.mediaPlaying = owner.state?.mediaPlaying;
    if (owner.state?.playing !== undefined) state.playing = owner.state.playing;
  }
  return JSON.stringify({ route: feeds.route, operationId, areaId, instanceId: owner.instanceId,
    targetId: action?.targetId ?? null, controlId: action?.controlId ?? null, state });
}

export function feedsActionObserved(before: any, after: any, actionId: string, userSnapshot?: any): boolean {
  if (!after) return false;
  const ownerId = before?.visibleControls?.find((c: any) => c.candidateActionId === actionId)?.areaId;
  const oldState = before?.areas?.[ownerId]?.state;
  const newState = after?.areas?.[ownerId]?.state;
  if (actionId.startsWith(`${DECK_AREA_ID}.action.`)) {
    if (!oldState) return false;
    const key = actionId.slice(`${DECK_AREA_ID}.action.`.length);
    if (key === 'play') return Number(oldState.activePostId) > 0
      && Object.entries(after.areas || {}).some(([id, area]: [string, any]) =>
        id.startsWith('clikb.feeds.fullscreen.') && Number(area.state?.postId) === Number(oldState.activePostId));
    if (key === 'close') return !after.areas?.[DECK_AREA_ID];
    if (key === 'creator_profile') {
      const creatorId = Number(oldState.activeCreatorId);
      if (!Number.isSafeInteger(creatorId) || creatorId <= 0) return false;
      if (newState) return newState.activeCategory === 'page' && Number(newState.profileOwnerId) === creatorId
        && !['loading', 'error'].includes(newState.status);
      return Object.entries(after.areas || {}).some(([id, area]: [string, any]) =>
        id.startsWith('clikb.feeds.context.') && Number(area.state?.profileOwnerId) === creatorId && !area.state?.loading);
    }
    if (key === 'open_create') return (userSnapshot?.ui?.minimisePrompt === false || userSnapshot?.creation?.promptOpen === true)
      && (!after.areas?.[DECK_AREA_ID] || newState?.creationBackdrop === true);
    if (key === 'category.page' && !after.areas?.[DECK_AREA_ID]
        && (userSnapshot?.ui?.minimisePrompt === false || userSnapshot?.creation?.promptOpen === true)) return true;
    if (!newState || newState.isOpen !== true) return false;
    const sameCollection = newState.activeCategory === oldState.activeCategory
      && newState.searchSection === oldState.searchSection && newState.searchQuery === oldState.searchQuery
      && newState.pageStart === oldState.pageStart && newState.collectionKey === oldState.collectionKey;
    const jump = key.match(/^jump_to\.(\d+)$/);
    if (jump) return sameCollection && Number(newState.activePostId) === Number(jump[1]);
    if (key === 'toggle_mute') return sameCollection && newState.activePostId === oldState.activePostId
      && typeof newState.isMuted === 'boolean' && newState.isMuted !== oldState.isMuted;
    if (key === 'toggle_slideshow') return sameCollection
      && typeof newState.slideshowActive === 'boolean' && newState.slideshowActive !== oldState.slideshowActive;
    if (key === 'select_category') return typeof newState.selectorOpen === 'boolean'
      && newState.selectorOpen !== oldState.selectorOpen;
    if (key === 'select_search_section') return typeof newState.searchSelectorOpen === 'boolean'
      && newState.searchSelectorOpen !== oldState.searchSelectorOpen;
    const searchSection = key.match(/^search_section\.(games|shorts|cinema)$/);
    if (searchSection) return newState.activeCategory === 'search' && newState.searchSection === searchSection[1]
      && newState.searchSection !== oldState.searchSection && !['loading', 'error'].includes(newState.status);
    if (key === 'run_search') return newState.activeCategory === 'search'
      && newState.searchRequestId !== oldState.searchRequestId
      && newState.searchQuery === String(oldState.searchInput || '').trim() && !['loading', 'error'].includes(newState.status);
    if (key === 'search_text') return newState.activeCategory === 'search' && newState.searchInput !== oldState.searchInput;
    if (key === 'resume_preview') return sameCollection && newState.activePostId === oldState.activePostId
      && oldState.autoplayBlocked === true && newState.autoplayBlocked === false && newState.mediaPlaying === true;
    const category = key.match(/^category\.(all|games|shorts|cinema|page|search)$/);
    if (category) return newState.activeCategory === category[1] && (newState.activeCategory !== oldState.activeCategory
        || (category[1] === 'page' && oldState.pageIsOwn === false && newState.pageIsOwn === true
          && newState.profileOwnerId !== oldState.profileOwnerId))
      && newState.status !== 'loading' && newState.status !== 'error';
    if (key === 'paginate') return newState.activeCategory === oldState.activeCategory
      && newState.status !== 'loading' && newState.status !== 'error'
      && ((newState.pageStart != null && newState.pageStart !== oldState.pageStart)
        || (newState.collectionKey != null && newState.collectionKey !== oldState.collectionKey));
    if (key === 'cycle_next' || key === 'cycle_prev') {
      const count = Number(oldState.totalCardsInBatch);
      if (!sameCollection || !Number.isInteger(count) || count <= 1 || !Number.isInteger(oldState.activeCardIndex)) return false;
      const expected = (oldState.activeCardIndex + (key === 'cycle_next' ? 1 : -1) + count) % count;
      return newState.activeCardIndex === expected && newState.activePostId !== oldState.activePostId;
    }
    return false;
  }
  const openPost = actionId.match(/\.action\.open\.(\d+)$/);
  if (openPost) return (after.areas?.[DECK_AREA_ID]?.state?.isOpen === true
      && Number(after.areas?.[DECK_AREA_ID]?.state?.activePostId) === Number(openPost[1]))
    || Object.entries(after.areas || {}).some(([id, area]: [string, any]) =>
      id.startsWith('clikb.feeds.fullscreen.') && Number(area.state?.postId) === Number(openPost[1]));
  if (/\.action\.creator\.\d+$/.test(actionId)) {
    const creatorId = Number(before.availableActions?.find((action: any) => action.actionId === actionId)?.targetId);
    return Number.isSafeInteger(creatorId) && creatorId > 0 && after.route?.toLowerCase() === '/pages'
      && Object.entries(after.areas || {}).some(([id, area]: [string, any]) =>
        id.startsWith('clikb.feeds.context.') && Number(area.state?.profileOwnerId) === creatorId
        && ['ready', 'empty'].includes(area.state?.status));
  }
  if (actionId.endsWith('.like_post')) return newState?.postId === oldState?.postId && newState?.liked === true;
  if (/\.(back_to_feed|close_shared)$/.test(actionId)) return !after.areas?.[ownerId];
  if (actionId.endsWith('.open_post_chat')) {
    const chat = userSnapshot?.navigation?.areas?.['clikb.navigation.social_chat']?.state;
    return chat?.tab === 'post' && Number(chat.postId) === Number(oldState?.postId);
  }
  if (/\.open_likes(_count)?$/.test(actionId)) {
    const likes = after.areas?.['clikb.feeds.likes']?.state;
    return newState?.postId === oldState?.postId && newState?.obscuredByLikes === true
      && Number(likes?.postId) === Number(oldState?.postId) && ['ready', 'empty', 'error'].includes(likes?.status);
  }
  if (actionId.endsWith('.open_plan')) return newState?.postId === oldState?.postId && newState?.planOpen === true;
  if (actionId.endsWith('.toggle_mute') || actionId.endsWith('.toggle_local_mute')) return newState?.postId === oldState?.postId && newState?.muted !== oldState?.muted;
  return feedsExecutionContext(before, actionId) !== feedsExecutionContext(after, actionId);
}
