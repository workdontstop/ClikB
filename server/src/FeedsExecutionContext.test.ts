import assert from 'node:assert/strict';
import test from 'node:test';
import { activeFeedRagDocIds, feedsActionObserved, feedsConversationSnapshot, feedsExecutionContext } from './FeedsExecutionContext';

const areaId = 'clikb.feeds.deck';
const deckSnapshot = (key: string, state: Record<string, unknown> = {}): any => {
  const actionId = `${areaId}.action.${key}`;
  return { surfaceId: 'clikb.feeds', ragDocId: 'clikb_feeds', route: '/feeds', activeAreaIds: [areaId],
    availableActions: [{ actionId, controlId: `${areaId}.control.${key}`, targetId: key.startsWith('jump_to.') ? Number(key.split('.').at(-1)) : undefined }],
    visibleControls: [{ candidateActionId: actionId, areaId, enabled: true }],
    areas: { [areaId]: { instanceId: 'deck.primary', state: { isOpen: true, activeCategory: 'all', activePostId: 123,
      activeCardIndex: 0, totalCardsInBatch: 28, isMuted: true, selectorOpen: false, pageStart: 0,
      collectionKey: '123,456', status: 'ready', ...state }, visiblePosts: [], visibleControls: [] } },
  };
};

test('Deck creator feedback requires the exact creator profile and My Page can leave another profile', () => {
  const before = deckSnapshot('creator_profile', { activeCreatorId: 42 });
  const after = deckSnapshot('creator_profile', { activeCategory: 'page', profileOwnerId: 42 });
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.creator_profile`), true);
  after.areas[areaId].state.profileOwnerId = 7;
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.creator_profile`), false);
  after.areas[areaId].state.profileOwnerId = 42;
  after.areas[areaId].state.status = 'loading';
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.creator_profile`), false);
  const grid = { areas: { 'clikb.feeds.context.page.primary': { state: { profileOwnerId: 42, loading: false } } } };
  assert.equal(feedsActionObserved(before, grid, `${areaId}.action.creator_profile`), true);
  const visitor = deckSnapshot('category.page', { activeCategory: 'page', profileOwnerId: 42, pageIsOwn: false });
  const own = deckSnapshot('category.page', { activeCategory: 'page', profileOwnerId: 7, pageIsOwn: true });
  assert.equal(feedsActionObserved(visitor, own, `${areaId}.action.category.page`), true);
});

test('Deck slideshow toggle feedback requires the observed flag change in the same collection', () => {
  const before = deckSnapshot('toggle_slideshow', { slideshowActive: false });
  const after = deckSnapshot('toggle_slideshow', { slideshowActive: true });
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.toggle_slideshow`), true);
  assert.equal(feedsActionObserved(before, before, `${areaId}.action.toggle_slideshow`), false);
  after.areas[areaId].state.collectionKey = 'new-page';
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.toggle_slideshow`), false);
});

test('live Deck adds its exact packet without replacing the Feeds packet', () => {
  const snapshot = deckSnapshot('play');
  assert.deepEqual(activeFeedRagDocIds(snapshot), ['clikb_feeds', 'clikb_deck']);
  delete snapshot.areas[areaId];
  assert.deepEqual(activeFeedRagDocIds(snapshot), ['clikb_feeds']);
  snapshot.ragDocId = 'clikb_deck';
  assert.deepEqual(activeFeedRagDocIds(snapshot), []);
});

test('full Deck context is omitted with Auto Control Off and bounded/allowlisted when On', () => {
  const snapshot = deckSnapshot('jump_to.456');
  snapshot.areas[areaId].visiblePosts = [{ postId: 123 }];
  snapshot.areas[areaId].collectionPosts = Array.from({ length: 35 }, (_, index) => ({
    postId: index + 1, contentKind: 'cinema', creator: { id: 7, username: 'u'.repeat(100) },
    metadata: { status: 'available', title: 't'.repeat(500), overviewHint: 'o'.repeat(800),
      tags: ['tag'.repeat(100), 'two', 'three', 'four', 'five'], categories: ['see https://example.com/private.mp4'] },
    capabilities: { fullscreen: true, video: true }, prompt: 'PRIVATE_PROMPT', videoUrl: 'https://example.com/private.mp4',
  }));
  const off = feedsConversationSnapshot(snapshot, false);
  assert.equal('collectionPosts' in off.areas[areaId], false);
  assert.equal(off.areas[areaId].visiblePosts[0].postId, 123);
  assert.equal(snapshot.areas[areaId].collectionPosts.length, 35, 'source Redux data is not mutated');
  const on = feedsConversationSnapshot(snapshot, true);
  const collection = on.areas[areaId].collectionPosts;
  assert.equal(collection.length, 28);
  assert.equal(collection[27].postId, 28);
  assert.equal(collection[0].metadata.title.length, 80);
  assert.equal(collection[0].metadata.overviewHint.length, 160);
  assert.equal(collection[0].creator.username.length, 48);
  assert.equal(collection[0].metadata.tags.length, 4);
  assert.equal(collection[0].metadata.tags[0].length, 32);
  assert.equal(JSON.stringify(collection).includes('PRIVATE_PROMPT'), false);
  assert.equal(JSON.stringify(collection).includes('https://'), false);
});

test('invalid and duplicate collection identities never become concierge targets', () => {
  const snapshot = deckSnapshot('play');
  snapshot.areas[areaId].collectionPosts = [{ postId: 7 }, { postId: 7 }, { postId: -1 }, { postId: 1.5 }, {}];
  assert.deepEqual(feedsConversationSnapshot(snapshot, true).areas[areaId].collectionPosts.map((post: any) => post.postId), [7]);
});

test('Deck jump feedback requires the exact target in the same collection', () => {
  const before = deckSnapshot('jump_to.456');
  const id = `${areaId}.action.jump_to.456`;
  assert.equal(feedsActionObserved(before, deckSnapshot('jump_to.456', { activePostId: 789 }), id), false);
  assert.equal(feedsActionObserved(before, deckSnapshot('jump_to.456', { activePostId: 456 }), id), true);
  assert.equal(feedsActionObserved(before, deckSnapshot('jump_to.456', { activePostId: 456, activeCategory: 'cinema' }), id), false);
});

test('Deck play feedback requires fullscreen at the centered post ID', () => {
  const before = deckSnapshot('play');
  const after = { areas: { 'clikb.feeds.fullscreen.mixed.primary': { state: { postId: 456 } } } };
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.play`), false);
  after.areas['clikb.feeds.fullscreen.mixed.primary'].state.postId = 123;
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.play`), true);
});

test('Deck mute and cycling feedback reject unrelated changes and accept wrapping', () => {
  const mute = deckSnapshot('toggle_mute');
  assert.equal(feedsActionObserved(mute, deckSnapshot('toggle_mute', { selectorOpen: true }), `${areaId}.action.toggle_mute`), false);
  assert.equal(feedsActionObserved(mute, deckSnapshot('toggle_mute', { isMuted: false }), `${areaId}.action.toggle_mute`), true);
  assert.equal(feedsActionObserved(mute, deckSnapshot('toggle_mute', { isMuted: false, activePostId: 456 }), `${areaId}.action.toggle_mute`), false);
  const previous = deckSnapshot('cycle_prev');
  assert.equal(feedsActionObserved(previous, deckSnapshot('cycle_prev', { activeCardIndex: 27, activePostId: 456 }), `${areaId}.action.cycle_prev`), true);
  assert.equal(feedsActionObserved(previous, deckSnapshot('cycle_prev', { activeCardIndex: 1, activePostId: 456 }), `${areaId}.action.cycle_prev`), false);
});

test('Deck category and pagination wait for the actual settled destination', () => {
  const category = deckSnapshot('category.cinema');
  assert.equal(feedsActionObserved(category, deckSnapshot('category.cinema', { selectorOpen: true }), `${areaId}.action.category.cinema`), false);
  assert.equal(feedsActionObserved(category, deckSnapshot('category.cinema', { activeCategory: 'cinema', status: 'loading' }), `${areaId}.action.category.cinema`), false);
  assert.equal(feedsActionObserved(category, deckSnapshot('category.cinema', { activeCategory: 'cinema' }), `${areaId}.action.category.cinema`), true);
  const pagination = deckSnapshot('paginate');
  assert.equal(feedsActionObserved(pagination, deckSnapshot('paginate', { status: 'loading' }), `${areaId}.action.paginate`), false);
  assert.equal(feedsActionObserved(pagination, deckSnapshot('paginate', { pageStart: 28, status: 'loading' }), `${areaId}.action.paginate`), false);
  assert.equal(feedsActionObserved(pagination, deckSnapshot('paginate', { pageStart: 28, collectionKey: '777,888' }), `${areaId}.action.paginate`), true);
});

test('Deck selector toggle and autoplay recovery follow the real local state', () => {
  const selector = deckSnapshot('select_category');
  assert.equal(feedsActionObserved(selector, deckSnapshot('select_category', { selectorOpen: true }), `${areaId}.action.select_category`), true);
  assert.equal(feedsActionObserved(deckSnapshot('select_category', { selectorOpen: true }), selector, `${areaId}.action.select_category`), true);
  const blocked = deckSnapshot('resume_preview', { autoplayBlocked: true, mediaPlaying: false });
  assert.equal(feedsActionObserved(blocked, deckSnapshot('resume_preview', { autoplayBlocked: false, mediaPlaying: false }), `${areaId}.action.resume_preview`), false);
  assert.equal(feedsActionObserved(blocked, deckSnapshot('resume_preview', { autoplayBlocked: false, mediaPlaying: true }), `${areaId}.action.resume_preview`), true);
});

test('Deck Create feedback verifies expanded composer; closing Deck alone is insufficient', () => {
  const before = deckSnapshot('open_create');
  const after = { areas: {} };
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.open_create`), false);
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.open_create`, { ui: { minimisePrompt: true } }), false);
  assert.equal(feedsActionObserved(before, after, `${areaId}.action.open_create`, { ui: { minimisePrompt: false } }), true);
  assert.equal(feedsActionObserved(deckSnapshot('close'), after, `${areaId}.action.close`), true);
});

test('ordinary grid opens observe the exact Deck post while direct fullscreen paths still work', () => {
  const action = 'clikb.feeds.viewport.shorts.primary.action.open.456';
  assert.equal(feedsActionObserved({}, deckSnapshot('play'), action), false);
  assert.equal(feedsActionObserved({}, deckSnapshot('play', { activePostId: 456 }), action), true);
  assert.equal(feedsActionObserved({}, { areas: { 'clikb.feeds.fullscreen.search.shorts': { state: { postId: 456 } } } }, action), true);
});

test('guest My Page feedback observes the creation/auth handoff without claiming login completed', () => {
  const before = deckSnapshot('category.page');
  assert.equal(feedsActionObserved(before, { areas: {} }, `${areaId}.action.category.page`), false);
  assert.equal(feedsActionObserved(before, { areas: {} }, `${areaId}.action.category.page`, { ui: { minimisePrompt: false } }), true);
});

test('Deck approval remains bound to category, collection and active card without telemetry churn', () => {
  const before = deckSnapshot('play');
  const signature = feedsExecutionContext(before, `${areaId}.action.play`);
  const next = structuredClone(before);
  next.areas[areaId].state.updatedAt = Date.now();
  next.areas[areaId].state.currentTime = 12;
  next.areas[areaId].state.currentSecond = 12;
  next.areas[areaId].state.durationSeconds = 45;
  next.areas[areaId].state.playing = true;
  assert.equal(feedsExecutionContext(next, `${areaId}.action.play`), signature);
  next.areas[areaId].state.activePostId = 456;
  assert.notEqual(feedsExecutionContext(next, `${areaId}.action.play`), signature);
  const videoArea = 'clikb.feeds.video';
  const makeVideoSnap = (muted: boolean, playing: boolean): any => ({
    route: '/feeds',
    availableActions: [
      { actionId: `${videoArea}.toggle_local_mute`, controlId: `${videoArea}.toggle_local_mute`, targetId: 123 },
      { actionId: `${videoArea}.toggle_play_pause`, controlId: `${videoArea}.toggle_play_pause`, targetId: 123 },
    ],
    visibleControls: [
      { candidateActionId: `${videoArea}.toggle_local_mute`, areaId: videoArea, enabled: true },
      { candidateActionId: `${videoArea}.toggle_play_pause`, areaId: videoArea, enabled: true },
    ],
    areas: { [videoArea]: { instanceId: 'video', state: { postId: 123, muted, playing, currentSecond: 5, durationSeconds: 30 } } },
  });
  assert.equal(feedsActionObserved(makeVideoSnap(false, true), makeVideoSnap(true, true), `${videoArea}.toggle_local_mute`), true);
  assert.notEqual(
    feedsExecutionContext(makeVideoSnap(false, true), `${videoArea}.toggle_play_pause`),
    feedsExecutionContext(makeVideoSnap(false, false), `${videoArea}.toggle_play_pause`),
  );
});
