import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  assembleNavigationSnapshot,
  appendNavigationTransition,
  emptyNavigationSnapshot,
  navigationControl,
  NAVIGATION_RAG_DOC_ID,
  NAVIGATION_SCHEMA_VERSION,
  NAVIGATION_SURFACE_ID,
  NAVIGATION_TRANSITION_LIMIT,
} from '../src/navigationControlSnapshot.js';

test('navigation mode matches its RAG ID and begins with no inferred actions', () => {
  const snapshot = emptyNavigationSnapshot();
  assert.equal(snapshot.surfaceId, NAVIGATION_SURFACE_ID);
  assert.equal(snapshot.ragDocId, NAVIGATION_RAG_DOC_ID);
  assert.deepEqual(snapshot.visibleControls, []);
  assert.deepEqual(snapshot.availableActions, []);
  assert.equal(snapshot.schemaVersion, NAVIGATION_SCHEMA_VERSION);
});

test('navigation transitions are ordered, bounded evidence and preserve actor/outcomes', () => {
  let snapshot = emptyNavigationSnapshot();
  const mutableBefore = { open: false };
  for (let index = 0; index < NAVIGATION_TRANSITION_LIMIT + 3; index += 1) {
    snapshot = appendNavigationTransition(snapshot, {
      timestamp: 1000 + index,
      actor: index === NAVIGATION_TRANSITION_LIMIT + 2 ? 'ai' : index === NAVIGATION_TRANSITION_LIMIT + 1 ? 'unknown' : 'manual',
      kind: 'control',
      before: { route: '/feeds', state: mutableBefore },
      after: { route: '/feeds', areaId: 'clikb.navigation.menu', state: { open: true } },
      outcome: index === 1 ? 'failed' : 'succeeded',
      authoritativeSource: 'test handler',
    });
  }
  mutableBefore.open = true;
  assert.equal(snapshot.recentTransitions.length, NAVIGATION_TRANSITION_LIMIT);
  assert.equal(snapshot.recentTransitions[0].sequence, 4);
  assert.equal(snapshot.recentTransitions.at(-1)?.sequence, NAVIGATION_TRANSITION_LIMIT + 3);
  assert.equal(snapshot.recentTransitions.at(-1)?.actor, 'ai');
  assert.equal(snapshot.recentTransitions.at(-2)?.actor, 'unknown');
  assert.equal(snapshot.recentTransitions[0].before.state?.open, false);
  assert.equal(snapshot.transitionSequence, NAVIGATION_TRANSITION_LIMIT + 3);
  assert.equal(snapshot.route, '/');
});

test('component areas assemble into the existing live mode without replacing siblings', () => {
  const menu = {
    areaId: 'clikb.navigation.menu' as const,
    source: 'MenuSlider:desktop_sidebar',
    state: { categoriesExpanded: false },
    visibleControls: [navigationControl('clikb.navigation.menu', 'categories', 'MenuSlider.onExpandCategories')],
  };
  const settings = {
    areaId: 'clikb.settings' as const,
    source: 'Settings',
    state: { themePreference: 'dark' },
    visibleControls: [navigationControl('clikb.settings', 'logout', 'Settings.handleLogout', 'manual_only')],
  };
  const first = assembleNavigationSnapshot(emptyNavigationSnapshot(), { route: '/settings', presentation: 'desktop_open' }, menu);
  const second = assembleNavigationSnapshot(first, undefined, settings);
  assert.deepEqual(second.activeAreaIds, ['clikb.navigation.menu', 'clikb.settings']);
  assert.equal(second.areas['clikb.navigation.menu']?.state.categoriesExpanded, false);
  assert.equal(second.areas['clikb.settings']?.state.themePreference, 'dark');
  assert.equal(second.visibleControls.length, 2);
  assert.equal(second.visibleControls[0].candidateActionId, 'clikb.navigation.menu.action.categories');
  assert.equal(second.visibleControls[1].candidateActionId, undefined);
  assert.deepEqual(second.availableActions, []);
  assert.equal(assembleNavigationSnapshot(second, undefined, settings), second);
  const withoutMenu = assembleNavigationSnapshot(second, undefined, undefined, 'clikb.navigation.menu');
  assert.deepEqual(withoutMenu.activeAreaIds, ['clikb.settings']);
  assert.equal(withoutMenu.stateVersion, second.stateVersion + 1);
});

test('a mounted action is removed when its owning control disappears', () => {
  const area = {
    areaId: 'clikb.navigation.menu' as const, source: 'MenuSlider', state: { categoriesExpanded: false },
    visibleControls: [navigationControl('clikb.navigation.menu', 'settings', 'MenuSlider.handleItemClick')],
  };
  const current = assembleNavigationSnapshot(emptyNavigationSnapshot(), undefined, area);
  const bound = { ...current, availableActions: [{ actionId: 'clikb.navigation.menu.action.settings', controlId: 'clikb.navigation.menu.control.settings' }] };
  const removed = assembleNavigationSnapshot(bound, undefined, undefined, 'clikb.navigation.menu');
  assert.deepEqual(removed.availableActions, []);
});

test('independent scroll owners retain their settled viewport and never create executable actions', () => {
  const base = emptyNavigationSnapshot();
  const area = {
    areaId: 'clikb.settings' as const,
    source: 'Settings',
    state: { themePreference: 'automatic' },
    visibleControls: [],
    scrolls: {
      page: { axis: 'vertical' as const, region: 'middle' as const, canScrollBackward: true, canScrollForward: true, visibleIds: ['clikb.settings.section.conversation_ai'], offsetBucketPx: 200, isScrolling: false, settledAt: 1234 },
      model_strip: { axis: 'horizontal' as const, region: 'end' as const, canScrollBackward: true, canScrollForward: false, visibleIds: ['clikb.settings.control.conversation_kimi'], offsetBucketPx: 100, isScrolling: false, settledAt: 1250 },
    },
  };
  const snapshot = assembleNavigationSnapshot(base, undefined, area);
  assert.deepEqual(Object.keys(snapshot.areas['clikb.settings']?.scrolls ?? {}), ['page', 'model_strip']);
  assert.deepEqual(snapshot.areas['clikb.settings']?.scrolls?.model_strip.visibleIds, ['clikb.settings.control.conversation_kimi']);
  assert.equal(snapshot.areas['clikb.settings']?.scrolls?.page.settledAt, 1234);
  assert.deepEqual(snapshot.availableActions, []);
});

test('the one navigation RAG explains every stable control family', () => {
  const packet = readFileSync(resolve(process.cwd(), 'docs/apps live rag fro app control/01_navigation_profile_settings.rag.txt'), 'utf8');
  assert.ok(packet.includes(`schemaVersion: ${NAVIGATION_SCHEMA_VERSION}`), 'live snapshot and RAG schema versions must match');
  assert.ok(packet.indexOf('modeOverview:') > 0 && packet.indexOf('modeOverview:') < packet.indexOf('visualHierarchy:'), 'human-readable mode overview must precede the node hierarchy');
  for (const globalControl of ['globalControlRefs:', 'clikb.global.auto_control.control.reveal', 'clikb.global.auto_control.control.toggle', 'hiding while active turns it Off']) {
    assert.ok(packet.includes(globalControl), `RAG must reference shared ${globalControl}`);
  }
  for (const summaryFact of ['Following or Followers', 'Load More', 'not a post-opening control', 'manual-only', 'dynamic availableActions']) {
    assert.ok(packet.includes(summaryFact), `mode overview must preserve ${summaryFact}`);
  }
  for (const term of ['menu_items', 'sidebar', 'people_list', 'model_strip', 'getCurrentSnapshot', 'post-action observation ping']) {
    assert.ok(packet.includes(term), `RAG must explain ${term}`);
  }
  for (const term of ['controlExecutionContract:', 'Accent color', 'accent_<effectiveMode>_<lowercaseColorName>', 'activeAccentName', 'userSnapshot.app.appearance', 'setAppColorDark', 'setAppColorLight']) {
    assert.ok(packet.includes(term), `RAG must explain ${term}`);
  }
  const controls: Record<string, string[]> = {
    'clikb.navigation.menu': ['create', 'categories', 'games', 'shorts', 'cinema', 'my_page_or_login', 'all_feeds', 'search', 'settings', 'thumbnail_creator'],
    'clikb.navigation.bottom_menu': ['cinema', 'shorts', 'games', 'my_page', 'menu'],
    'clikb.navigation.menu_backdrop': ['close'],
    'clikb.navigation.toggle': ['toggle_sidebar', 'exit_fullscreen'],
    'clikb.navigation.quick_create': ['open_creation'],
    'clikb.profile_header': ['change_banner', 'change_avatar', 'floating_avatar_scroll_top', 'expand_header', 'thumbnail_creator', 'following', 'followers', 'follow', 'follow_complete', 'crop_back', 'crop_save'],
    'clikb.navigation.relationships': ['tab_following', 'tab_followers', 'close', 'backdrop_close', 'load_more'],
    'clikb.navigation.relationship_row.<personId>': ['expand_or_collapse', 'avatar_profile', 'username_profile', 'latest_text_profile', 'preview_image_expand', 'preview_image_profile', 'follow', 'unfollow'],
    'clikb.settings': ['theme_automatic', 'theme_light', 'theme_dark', 'conversation_luna_none', 'conversation_luna', 'conversation_luna_xhigh', 'conversation_terra', 'privacy_policy', 'logout'],
  };
  for (const [areaId, names] of Object.entries(controls)) {
    for (const name of names) {
      assert.ok(packet.includes(`${areaId}.control.${name}`), `${areaId}.control.${name} must be explained in the RAG`);
    }
  }
});
