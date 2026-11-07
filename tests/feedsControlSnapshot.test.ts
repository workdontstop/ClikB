import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { canPingFullscreen, fullscreenPingMessage, formatNavigationHistory, FULLSCREEN_SLIDESHOW_GUIDANCE } from '../src/fullscreenHeartbeat.js';

test('slideshow guidance uses successful advance time and a single brief acknowledgement', () => {
  assert.match(FULLSCREEN_SLIDESHOW_GUIDANCE, /acknowledge once/);
  assert.match(FULLSCREEN_SLIDESHOW_GUIDANCE, /last successful post advance/);
  assert.match(FULLSCREEN_SLIDESHOW_GUIDANCE, /eight seconds/);
  assert.match(FULLSCREEN_SLIDESHOW_GUIDANCE, /Do not append a response-delay disclaimer/);
  assert.match(fullscreenPingMessage(12000, 0), /otherwise return \[NO_UPDATE\]/);
});

test('navigation summary uses only five existing timestamped outcomes', () => {
  const events = Array.from({ length: 9 }, (_, i) => ({ timestamp: i * 1000, outcome: i === 8 ? 'failed' : 'succeeded', actor: 'ai', after: { controlId: 'open', entityId: i } }));
  const text = formatNavigationHistory(events, 10000);
  assert.equal(text.split('\n').length, 6);
  assert.match(text, /2s ago · ai · open · target 8 · failed/);
  assert.doesNotMatch(text, /target 0/);
});

test('fullscreen continuation eligibility uses shared Auto Control, concierge and fullscreen', () => {
  const on = { autoControlEnabled: true, conciergeEnabled: true };
  const full = ['clikb.feeds.fullscreen.mixed.primary'];
  assert.equal(canPingFullscreen(on, full), true);
  assert.equal(canPingFullscreen({ ...on, autoControlEnabled: false }, full), false);
  assert.equal(canPingFullscreen({ ...on, conciergeEnabled: false }, full), false);
  assert.equal(canPingFullscreen(on, ['clikb.feeds.viewport.mixed.primary']), false);
  assert.equal(canPingFullscreen(on, []), false);
  assert.match(fullscreenPingMessage(10000, 4000), /elapsed since activation: 6000 ms/);
  assert.match(fullscreenPingMessage(10000, 4000), /not a new user instruction/);
});

test('opening Likes waits for a response for the same post', () => {
  const id = 'clikb.feeds.fullscreen.mixed.primary';
  const actionId = `${id}.open_likes`;
  const before: any = { visibleControls: [{ candidateActionId: actionId, areaId: id }], areas: { [id]: { state: { postId: 123 } } } };
  const after: any = { areas: { [id]: { state: { postId: 123, obscuredByLikes: true } }, 'clikb.feeds.likes': { state: { postId: 123, status: 'loading' } } } };
  assert.equal(feedsActionObserved(before, after, actionId), false);
  after.areas['clikb.feeds.likes'].state.status = 'ready';
  assert.equal(feedsActionObserved(before, after, actionId), true);
  after.areas['clikb.feeds.likes'].state.postId = 456;
  assert.equal(feedsActionObserved(before, after, actionId), false);
});
import { feedsExecutionContext, feedsActionObserved } from '../server/src/FeedsExecutionContext.js';

test('Post chat is observed only on the Post tab for the displayed post', () => {
  const area = 'clikb.feeds.fullscreen.mixed.primary';
  const action = `${area}.open_post_chat`;
  const feeds = { visibleControls: [{ candidateActionId: action, areaId: area }], areas: { [area]: { state: { postId: 123 } } } };
  const snapshot = (tab: string, postId: number) => ({ navigation: { areas: { 'clikb.navigation.social_chat': { state: { tab, postId } } } } });
  assert.equal(feedsActionObserved(feeds, feeds, action, snapshot('feeds', 123)), false);
  assert.equal(feedsActionObserved(feeds, feeds, action, snapshot('post', 456)), false);
  assert.equal(feedsActionObserved(feeds, feeds, action, snapshot('post', 123)), true);
});

test('Feeds approvals survive unrelated telemetry, but not a different post or scroll position', () => {
  const id = 'clikb.feeds.fullscreen.mixed.primary';
  const actionId = `${id}.like_post`;
  const feeds: any = { route: '/feeds', stateVersion: 1,
    availableActions: [{ actionId, controlId: actionId, targetId: 123 }],
    visibleControls: [{ candidateActionId: actionId, areaId: id, enabled: true }],
    areas: { [id]: { instanceId: 'mixed.primary', state: { postId: 123, liked: false, scrollTop: 0, mediaPlaying: true } } } };
  const signature = feedsExecutionContext(feeds, actionId);
  const changed = structuredClone(feeds);
  changed.stateVersion++;
  changed.areas[id].state.mediaPlaying = false;
  changed.areas.other = { state: { currentTime: 5 } };
  assert.equal(feedsExecutionContext(changed, actionId), signature);
  assert.equal(feedsActionObserved(feeds, changed, actionId), false);
  changed.areas[id].state.liked = true;
  assert.equal(feedsActionObserved(feeds, changed, actionId), true);
  changed.areas[id].state.postId = 456;
  assert.notEqual(feedsExecutionContext(changed, actionId), signature);
  assert.equal(feedsActionObserved(feeds, changed, actionId), false);
  const scroll = `${id}:posts`;
  const scrollSignature = feedsExecutionContext(feeds, scroll);
  feeds.areas[id].state.scrollTop = 500;
  assert.notEqual(feedsExecutionContext(feeds, scroll), scrollSignature);
});

test('opening a post is successful only when fullscreen shows that exact post', () => {
  const action = 'clikb.feeds.viewport.mixed.primary.action.open.123';
  const after: any = { areas: { 'clikb.feeds.fullscreen.mixed.primary': { state: { postId: 456 } } } };
  assert.equal(feedsActionObserved({}, after, action), false);
  after.areas['clikb.feeds.fullscreen.mixed.primary'].state.postId = 123;
  assert.equal(feedsActionObserved({}, after, action), true);
});
import { appendUnseenFeedPosts } from '../src/feedsPagination.js';
import {
  assembleFeedsSnapshot, emptyFeedsSnapshot, feedDisplayName, feedInstanceId, feedScrollAvailability, horizontalFeedScrollBounds,
  FEEDS_MAX_SNAPSHOT_CHARS, FEEDS_MAX_VISIBLE_CARDS, FEEDS_SCHEMA_VERSION,
  FEEDS_SURFACE_ID, FEEDS_SURFACE_TITLE, FEEDS_RAG_DOC_ID,
  applyFeedCardOcclusion, detailedVisibleIds, measureFeedCardVisibility, summariseVisiblePostRefs, summariseVisiblePosts,
  boundedFeedTextHint,
} from '../src/feedsControlSnapshot.js';

test('overlapping pagination pages add each post once and detect no progress', () => {
  const loaded = [{ id: 30 }, { id: 29 }, { id: 28 }];
  const next = appendUnseenFeedPosts(loaded, [{ id: 29 }, { id: 28 }, { id: 27 }, { id: 27 }, { id: 26 }]);
  assert.deepEqual(next.map(post => post.id), [30, 29, 28, 27, 26]);
  assert.equal(appendUnseenFeedPosts(next, [{ id: 29 }, { id: 28 }]), next);
});

test('horizontal feed directions use the same clamped ends as the rendered strip', () => {
  assert.deepEqual(horizontalFeedScrollBounds(1000, false), { min: 30, max: 990 });
  assert.deepEqual(horizontalFeedScrollBounds(1000, true), { min: 10, max: 990 });
  assert.deepEqual(feedScrollAvailability(30, 1000, false, false), {
    canScrollBackward: false, canScrollForward: true, region: 'start',
  });
  assert.deepEqual(feedScrollAvailability(990, 1000, false, false), {
    canScrollBackward: true, canScrollForward: false, region: 'end',
  });
  assert.deepEqual(feedScrollAvailability(1000, 1000, true, false), {
    canScrollBackward: true, canScrollForward: false, region: 'end',
  });
  assert.deepEqual(feedScrollAvailability(0, 0, false, false), {
    canScrollBackward: false, canScrollForward: false, region: 'all',
  });
});

test('one Feeds contract retains independent Search instances and cleans up the owner', () => {
  assert.equal(feedInstanceId(1, false), 'search.shorts');
  assert.equal(feedInstanceId(2, false), 'search.cinema');
  assert.equal(feedInstanceId(3, false), 'search.games');
  const shorts = { areaId: 'clikb.feeds.context.search.shorts' as const, source: 'FeedsGate', instanceId: 'search.shorts', state: { loadedCount: 2 }, visiblePosts: [], visibleControls: [] };
  const cinema = { ...shorts, areaId: 'clikb.feeds.context.search.cinema' as const, instanceId: 'search.cinema' };
  const a = assembleFeedsSnapshot(emptyFeedsSnapshot(), '/search', shorts);
  const b = assembleFeedsSnapshot(a, undefined, cinema);
  assert.equal(b.surfaceId, 'clikb.feeds');
  assert.equal(b.ragDocId, 'clikb_feeds');
  assert.deepEqual(b.activeAreaIds, [shorts.areaId, cinema.areaId]);
  assert.deepEqual(assembleFeedsSnapshot(b, undefined, undefined, shorts.areaId).activeAreaIds, [cinema.areaId]);
});

test('mounted context route updates the top-level Feeds route', () => {
  const context = {
    areaId: 'clikb.feeds.context.mixed.primary' as const,
    source: 'FeedsGate', instanceId: 'mixed.primary',
    state: { route: '/feeds', loadedCount: 28 }, visiblePosts: [], visibleControls: [],
  };
  const live = assembleFeedsSnapshot(emptyFeedsSnapshot(), undefined, context);
  assert.equal(live.route, '/feeds');
  const shared = assembleFeedsSnapshot(live, undefined, { ...context, state: { ...context.state, route: '/experience/4360' } });
  assert.equal(shared.route, '/experience/4360');
});

test('default mixed feed is named All Feeds, distinct from a direct shared post', () => {
  assert.equal(feedDisplayName(4, true), 'All Feeds');
  assert.equal(feedDisplayName(4, true, 'shared_link'), 'Shared post');
  assert.equal(feedDisplayName(1, true), 'Shorts');
  assert.equal(feedDisplayName(1, false), 'Search Shorts');
});

test('large posts produce bounded visible-only summaries without creative or media payloads', () => {
  const huge = 'secret-long-prompt-'.repeat(10000);
  const posts = Array.from({ length: 50 }, (_, index) => ({
    id: index + 1, sender: 22, username: `creator${index}`, mode: 2,
    caption: huge, prompt: huge, intentBlueprintJson: huge, spatialExperienceJson: huge,
    x1: `https://example.com/${huge}`, videoUrl: `https://example.com/${huge}`,
    finalTitle: index === 0 ? huge : undefined,
    finalOverview: index === 0 ? huge : undefined,
    categories: index === 0 ? Array(30).fill(huge) : undefined,
    tags: index === 0 ? Array(30).fill(huge) : undefined,
  }));
  const visible = summariseVisiblePosts(posts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  assert.equal(visible.length, FEEDS_MAX_VISIBLE_CARDS);
  assert.equal(visible[0].metadata.title?.length, 80);
  assert.equal(visible[0].metadata.overviewHint?.length, 160);
  assert.equal(visible[1].metadata.status, 'available');
  assert.equal(visible[1].metadata.legacyCaptionHint?.length, 120);
  assert.equal(visible.some(post => post.postId === 20), false);
  const json = JSON.stringify(visible);
  assert.ok(json.length < FEEDS_MAX_SNAPSHOT_CHARS);
  assert.equal(json.includes(huge), false);
  assert.equal(json.includes('https://'), false);
  assert.equal(json.includes('intentBlueprintJson'), false);
});

test('all intersecting cards retain compact identity while rich summaries stay capped', () => {
  const posts = Array.from({ length: 28 }, (_, index) => ({
    id: index + 1, caption: `Card ${index + 1} ` + 'c'.repeat(1000), prompt: 'p'.repeat(1000) + 'offscreen-tail',
  }));
  const intersecting = Array.from({ length: 12 }, (_, index) => index + 3);
  const rich = summariseVisiblePosts(posts, intersecting.slice(0, FEEDS_MAX_VISIBLE_CARDS));
  const refs = summariseVisiblePostRefs(posts, intersecting.map(id => ({ id: String(id), visiblePercent: 100, fullyVisible: true, occluded: false })));
  assert.equal(rich.length, 6);
  assert.deepEqual(refs.map(ref => ref.postId), intersecting);
  assert.match(refs[11].labelHint, /^Post 14/);
  assert.ok(refs[11].labelHint.length <= 120);
  assert.equal(JSON.stringify(refs).includes('offscreen-tail'), false);
  assert.equal(refs.some(ref => ref.postId === 20), false);
});

test('fully visible cards outrank slivers and partial cards retain measured visibility', () => {
  const viewport = { top: 0, bottom: 100, left: 0, right: 100 };
  const full = measureFeedCardVisibility({ top: 0, bottom: 100, left: 0, right: 100 }, viewport);
  const almost = measureFeedCardVisibility({ top: -1, bottom: 99, left: 0, right: 100 }, viewport);
  const sliver = measureFeedCardVisibility({ top: 99, bottom: 199, left: 0, right: 100 }, viewport);
  assert.deepEqual(full, { visiblePercent: 100, fullyVisible: true });
  assert.deepEqual(almost, { visiblePercent: 99, fullyVisible: false });
  assert.deepEqual(sliver, { visiblePercent: 1, fullyVisible: false });
  const cards = [
    { id: '1', ...sliver, occluded: false }, { id: '2', ...almost, occluded: false },
    ...Array.from({ length: 6 }, (_, index) => ({ id: String(index + 3), ...full, occluded: false })),
  ];
  const selected = detailedVisibleIds(cards);
  assert.deepEqual(selected, ['3', '4', '5', '6', '7', '8']);
  const posts = cards.map(card => ({ id: Number(card.id), caption: `Post ${card.id}` }));
  assert.deepEqual(summariseVisiblePosts(posts, selected).map(post => post.postId), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(summariseVisiblePostRefs(posts, cards).map(ref => ref.visiblePercent), [1, 99, 100, 100, 100, 100, 100, 100]);
  const guideCovered = applyFeedCardOcclusion(full, 7, 9);
  assert.deepEqual(guideCovered, { visiblePercent: 78, fullyVisible: false, occluded: true });
});

test('two desktop rows can be partly then wholly visible without losing any of twelve identities', () => {
  const posts = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, caption: `Post ${index + 1}` }));
  const firstView = posts.map((post, index) => ({ id: String(post.id), visiblePercent: index < 6 ? 77 : 100,
    fullyVisible: index >= 6, occluded: false }));
  assert.deepEqual(detailedVisibleIds(firstView), ['7', '8', '9', '10', '11', '12']);
  assert.deepEqual(summariseVisiblePostRefs(posts, firstView).map(ref => ref.fullyVisible),
    [false, false, false, false, false, false, true, true, true, true, true, true]);
  const secondView = firstView.map(card => ({ ...card, visiblePercent: 100, fullyVisible: true }));
  assert.equal(summariseVisiblePostRefs(posts, secondView).length, 12);
  assert.equal(summariseVisiblePostRefs(posts, secondView).every(ref => ref.fullyVisible), true);
});

test('the local one-RAG draft matches frozen Feeds identity and mapped card control', () => {
  const rag = readFileSync(resolve(process.cwd(), 'docs/apps live rag fro app control/02_feeds_usage.rag.txt'), 'utf8');
  assert.ok(rag.includes(`docId: "${FEEDS_RAG_DOC_ID}"`));
  assert.ok(rag.includes(`surfaceId: "${FEEDS_SURFACE_ID}"`));
  assert.ok(rag.includes(`surfaceTitle: "${FEEDS_SURFACE_TITLE}"`));
  assert.ok(rag.includes(`schemaVersion: ${FEEDS_SCHEMA_VERSION}`));
  assert.ok(rag.includes('clikb.feeds.viewport.<instanceId>.control.open.<postId>'));
  assert.equal((rag.match(/\[RAG clikbKnowledge\]/g) || []).length, 1);
});

test('every mapped Feeds owner has a local RAG area explanation before execution', () => {
  const rag = readFileSync(resolve(process.cwd(), 'docs/apps live rag fro app control/02_feeds_usage.rag.txt'), 'utf8');
  const owners: Array<[string, string]> = [
    ['src/FeedsGate.tsx', 'clikb.feeds.context.<instanceId>'],
    ['src/FullScreenStories.tsx', 'clikb.feeds.fullscreen.<instanceId>'],
    ['src/VideoPlayer.tsx', 'clikb.feeds.video'],
    ['src/EmotionsGate.tsx', 'clikb.feeds.likes'],
    ['src/Plan.tsx', 'clikb.feeds.plan'],
    ['src/Homepage.tsx', 'clikb.feeds.search'],
    ['src/KeywordSelector.tsx', 'clikb.feeds.search_keywords'],
    ['src/TouchPreviewStageUI.tsx', 'clikb.feeds.hotspot'],
    ['src/SwipePreviewStageUI.tsx', 'clikb.feeds.swipe'],
    ['src/SpatialExperiencePlayer.tsx', 'clikb.feeds.spatial'],
  ];
  for (const [path, area] of owners) {
    assert.ok(readFileSync(resolve(process.cwd(), path), 'utf8').includes('publishFeedsArea'), `${path} does not publish`);
    assert.ok(rag.includes(area), `${area} missing from single RAG draft`);
  }
  for (const control of ['browse_all_feeds', 'scroll_posts', 'scroll_scenes', 'close_by_padding',
    'toggle_play_pause', 'toggle_local_mute', 'seek', 'open_likes_count', 'load_more',
    'share_public_link', 'request_delete', 'open_media_', 'search_field', 'run_search',
    'keyword_<word>', 'hold_controller', 'drag_stick', 'dismiss_first_impression',
    'swipe_left', 'return_to_main', 'open_settings', 'activate_interaction', 'drive']) {
    assert.ok(rag.includes(control), `${control} missing from RAG draft`);
  }
});

test('Plan text hints are bounded and do not leak URL or full source', () => {
  const source = 'PRIVATE_PROMPT '.repeat(10000) + 'https://media.example/private.mp4';
  const hint = boundedFeedTextHint(source, 120);
  assert.equal(hint.length, 120);
  assert.equal(hint.includes('https://'), false);
  assert.equal(hint.includes('.mp4'), false);
  assert.equal(hint.includes(source), false);
  assert.equal(boundedFeedTextHint('see https://media.example/private.mp4 now', 120), 'see [link] now');
});

test('Plan measures its scrolling body and gates scene media on intersecting elements', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/Plan.tsx'), 'utf8');
  assert.match(source, /\/\* Body \*\/\}\s*<div\s+ref=\{bodyRef\}/);
  assert.ok(source.includes("body.querySelectorAll('[data-plan-media]')"));
  assert.ok(source.includes("body.querySelectorAll('[data-plan-text]')"));
  assert.ok(source.includes('...visibleMediaIds.map(id =>'));
  assert.ok(source.includes('data-plan-media={`scene-${s.n}-A-image`}'));
  assert.ok(source.includes('data-plan-media={`scene-${s.n}-B-video`}'));
  assert.ok(source.includes('data-plan-media={`scene-${s.n}-A-audio`}'));
});

test('oversized area updates cannot enter the Feeds snapshot', () => {
  assert.throws(() => assembleFeedsSnapshot(emptyFeedsSnapshot(), '/feeds', {
    areaId: 'clikb.feeds.context.mixed.primary', source: 'test', instanceId: 'mixed.primary',
    state: { errorHint: 'x'.repeat(FEEDS_MAX_SNAPSHOT_CHARS) }, visiblePosts: [], visibleControls: [],
  }), /bounded contract/);
});

test('three full Search sections coexist within the total cap', () => {
  let snapshot = emptyFeedsSnapshot();
  for (const [type, section] of [[3, 'games'], [1, 'shorts'], [2, 'cinema']] as const) {
    const posts = Array.from({ length: FEEDS_MAX_VISIBLE_CARDS }, (_, index) => ({
      id: type * 1000 + index + 1, sender: 9999, username: 'u'.repeat(48), mode: type,
      finalTitle: 't'.repeat(80), finalOverview: 'o'.repeat(160),
      categories: Array(4).fill('c'.repeat(32)), tags: Array(4).fill('g'.repeat(32)),
    }));
    const visiblePosts = summariseVisiblePosts(posts, posts.map(post => post.id));
    const visiblePostRefs = Array.from({ length: 18 }, (_, index) => ({ postId: type * 1000 + index + 1,
      labelHint: 'l'.repeat(48), visiblePercent: 100, fullyVisible: true, occluded: false }));
    const areaId = `clikb.feeds.viewport.search.${section}` as const;
    snapshot = assembleFeedsSnapshot(snapshot, '/search', {
      areaId, source: 'FeedLayoutHorizontal', instanceId: `search.${section}`,
      state: { loadedCount: 28, scrollOwner: 'feedContainerRef' }, visiblePosts,
      visiblePostRefs,
      visibleControls: visiblePostRefs.map(ref => ({
        areaId, controlId: `${areaId}.control.open.${ref.postId}`,
        candidateActionId: `${areaId}.action.open.${ref.postId}`,
        handlerRef: 'StoryAutoScroller.onClick → FeedsGate.handleOpenFullscreen',
        enabled: true, aiPolicy: 'candidate' as const, targetId: ref.postId,
      })),
    });
  }
  assert.equal(snapshot.activeAreaIds.length, 3);
  assert.ok(JSON.stringify(snapshot).length <= FEEDS_MAX_SNAPSHOT_CHARS, String(JSON.stringify(snapshot).length));
});
