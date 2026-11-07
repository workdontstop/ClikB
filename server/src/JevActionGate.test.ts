import assert from 'node:assert/strict';
import test from 'node:test';
import { assessJevAction, chooseJevProposedOperation } from './JevActionGate';

const actionId = 'clikb.settings.action.theme_light';
const controlId = 'clikb.settings.control.theme_light';
const snapshot = {
  navigation: { route: '/settings', stateVersion: 9, availableActions: [{ actionId, controlId }], visibleControls: [{ controlId, candidateActionId: actionId, areaId: 'clikb.settings', handlerRef: 'Settings.setThemePreference' }], activeAreaIds: ['clikb.settings'] },
  autoControl: { enabled: true, visible: true, conciergeEnabled: true },
};
const ragContext = `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_navigation_shell\n${controlId} — switch to Light appearance.\nRAG_TRAINING_MEMORY_STATUS: skipped`;

test('Jev receives the unparsed concierge proposal and live controls, then selects the action', async () => {
  const proposal = 'I propose clicking Light because the user requested it. This is prose, not JSON.';
  const selected = await chooseJevProposedOperation({ userGoal: 'Use Light', proposal, snapshot }, async (question) => {
    assert.equal(question.kind, 'choice');
    assert.equal(JSON.parse(question.context || '{}').conciergeActionProposal, proposal);
    assert.ok(question.options?.includes(actionId));
    assert.ok(question.options?.includes('no_action'));
    assert.equal(question.options?.some(option => option.startsWith('auto_control:')), false);
    assert.equal(question.snapshotPointers?.includes('/autoControl'), true);
    assert.equal(Object.hasOwn(JSON.parse(question.context || '{}'), 'autoControl'), false);
    assert.match(question.optionDescriptions?.[actionId] || '', /Click theme light in settings/);
    assert.equal(question.snapshotPointers?.includes('/navigation/availableActions'), false);
    return { status: 'ok', answer: { type: 'choice', choice: actionId } };
  });
  assert.deepEqual(selected.operation, { kind: 'click', actionId, controlId, targetId: undefined });
  assert.equal(selected.status, 'selected');
});

test('Jev sees a mounted Feeds card and its real viewport scroll without treating candidate-only controls as executable', async () => {
  const feedActionId = 'clikb.feeds.viewport.mixed.primary.action.open.4360';
  const feedControlId = 'clikb.feeds.viewport.mixed.primary.control.open.4360';
  const feedAreaId = 'clikb.feeds.viewport.mixed.primary';
  const withFeeds = {
    ...snapshot,
    feeds: { route: '/feeds', stateVersion: 4,
      availableActions: [{ actionId: feedActionId, controlId: feedControlId, targetId: 4360 }],
      visibleControls: [{ controlId: feedControlId, candidateActionId: feedActionId,
        areaId: feedAreaId, handlerRef: 'StoryAutoScroller.onClick' }],
      areas: { [feedAreaId]: { state: { canScrollForward: true, canScrollBackward: false, hiddenByFullscreen: false } } },
    },
  };
  const click = await chooseJevProposedOperation({ userGoal: 'Open this post', proposal: feedActionId, snapshot: withFeeds }, async question => {
    assert.ok(question.options?.includes(feedActionId));
    assert.ok(question.snapshotPointers?.some(p => p.startsWith('/feeds/availableActions')));
    assert.ok(question.options?.includes(`scroll:${feedAreaId}:feed:forward`));
    assert.ok(!question.options?.includes(`scroll:${feedAreaId}:feed:backward`));
    assert.match(question.optionDescriptions?.[feedActionId] || '', /StoryAutoScroller\.onClick/);
    return { status: 'ok', answer: { type: 'choice', choice: feedActionId } };
  });
  assert.deepEqual(click.operation, { kind: 'click', actionId: feedActionId, controlId: feedControlId, targetId: 4360 });
  const scroll = await chooseJevProposedOperation({ userGoal: 'Scroll down', proposal: 'Scroll the feed', snapshot: withFeeds }, async () =>
    ({ status: 'ok', answer: { type: 'choice', choice: `scroll:${feedAreaId}:feed:forward` } }));
  assert.deepEqual(scroll.operation, { kind: 'scroll', scrollId: `${feedAreaId}:feed`, direction: 'forward' });
});

test('Jev can select the current fullscreen post or Plan scroll owner', async () => {
  const fullscreenId = 'clikb.feeds.fullscreen.mixed.primary';
  const planId = 'clikb.feeds.plan';
  const withOwners = { ...snapshot, feeds: { route: '/feeds', availableActions: [], areas: {
    [fullscreenId]: { state: { scrollTop: 200, scrollMax: 800, canScrollScenesForward: true,
      canScrollScenesBackward: false, captionExpanded: false, obscuredByLikes: false, planOpen: false, editOpen: false } },
    [planId]: { state: { scrollTop: 70, scrollMax: 300, zoomOpen: false } },
  } } };
  await chooseJevProposedOperation({ userGoal: 'Scroll down through this story', proposal: 'Scroll posts', snapshot: withOwners }, async question => {
    assert.ok(question.options?.includes(`scroll:${fullscreenId}:posts:forward`));
    assert.ok(question.options?.includes(`scroll:${fullscreenId}:scenes:forward`));
    assert.ok(question.options?.includes(`scroll:${planId}:body:forward`));
    assert.ok(!question.options?.includes(`scroll:${fullscreenId}:scenes:backward`));
    return { status: 'ok', answer: { type: 'choice', choice: `scroll:${fullscreenId}:posts:forward` } };
  });
});

test('a Guide-proposed Feeds action remains visible to Jev above the bounded choice limit', async () => {
  const preferred = 'clikb.feeds.viewport.search.cinema.action.open.999';
  const actions = Array.from({ length: 70 }, (_, index) => ({
    actionId: index === 69 ? preferred : `clikb.feeds.viewport.search.shorts.action.open.${index}`,
    controlId: index === 69 ? preferred.replace('.action.', '.control.')
      : `clikb.feeds.viewport.search.shorts.control.open.${index}`,
  }));
  const selected = await chooseJevProposedOperation({ userGoal: 'Open the last post',
    proposal: JSON.stringify({ suggestedActionId: preferred }),
    snapshot: { ...snapshot, feeds: { route: '/search', availableActions: actions, visibleControls: [], areas: {} } } },
  async question => {
    assert.equal(question.options?.[0], preferred);
    assert.equal(question.options?.at(-1), 'no_action');
    assert.ok((question.options?.length || 0) <= 64);
    return { status: 'ok', answer: { type: 'choice', choice: preferred } };
  });
  assert.equal(selected.status, 'selected');
});

test('Jev chooses Creation by display label while the internal model ID stays in the action key', async () => {
  const id = 'clikb.creation.models.action.lite_Imagen';
  const controlId = 'clikb.creation.models.control.lite_Imagen';
  const creation = { controls: { stateVersion: 8, areas: { 'clikb.creation.models': { areaId: 'clikb.creation.models',
    controls: [{ actionId: id, controlId, kind: 'click', policy: 'candidate', enabled: true,
      label: 'Select Nano Banana', handlerRef: 'updateModelWithoutClosing' }],
  } } } };
  const selected = await chooseJevProposedOperation({ userGoal: 'Select Nano Banana',
    proposal: JSON.stringify({ suggestedActionId: id }), snapshot: { ...snapshot, creation } }, async question => {
    assert.equal(question.options?.[0], id);
    assert.match(question.optionDescriptions?.[id] || '', /Select Nano Banana/);
    assert.ok(question.snapshotPointers?.includes('/creation/controls/areas/clikb.creation.models/state'));
    assert.ok(question.snapshotPointers?.includes('/creation/controls/areas/clikb.creation.models/controls/0'));
    return { status: 'ok', answer: { type: 'choice', choice: id } };
  });
  assert.deepEqual(selected.operation, { kind: 'click', actionId: id, controlId });
});

test('Creation text is selectable only with a matching explicit replacement value in the proposal', async () => {
  const id = 'clikb.creation.notepad.action.prompt';
  const controlId = 'clikb.creation.notepad.control.prompt';
  const creation = { controls: { stateVersion: 3, areas: { 'clikb.creation.notepad': { areaId: 'clikb.creation.notepad',
    controls: [{ actionId: id, controlId, kind: 'text', policy: 'candidate', enabled: true,
      label: 'Main creation prompt', handlerRef: 'handleBaseChange' }],
  } } } };
  const withCreation = { ...snapshot, creation };
  const missing = await chooseJevProposedOperation({ userGoal: 'Write the prompt', proposal: JSON.stringify({ suggestedActionId: id }),
    snapshot: withCreation }, async question => {
    assert.ok(!question.options?.includes(id));
    return { status: 'ok', answer: { type: 'choice', choice: 'no_action' } };
  });
  assert.equal(missing.status, 'declined');
  const selected = await chooseJevProposedOperation({ userGoal: 'Write a tiger',
    proposal: JSON.stringify({ suggestedActionId: id, textValue: 'A tiger at dawn' }), snapshot: withCreation }, async question => {
    assert.match(question.optionDescriptions?.[id] || '', /A tiger at dawn/);
    return { status: 'ok', answer: { type: 'choice', choice: id } };
  });
  assert.deepEqual(selected.operation, { kind: 'text', actionId: id, controlId, text: 'A tiger at dawn' });
});

test('Jev exposes only currently permitted Creation scroll directions and no handoff controls', async () => {
  const scrollId = 'clikb.creation.models.action.scroll';
  const creation = { controls: { stateVersion: 5, areas: { 'clikb.creation.models': { areaId: 'clikb.creation.models', controls: [
    { actionId: scrollId, controlId: 'clikb.creation.models.control.scroll', kind: 'scroll', policy: 'candidate',
      enabled: true, label: 'Scroll model picker', canScrollForward: true, canScrollBackward: false },
    { actionId: 'clikb.creation.upload.action.device', controlId: 'clikb.creation.upload.control.device', kind: 'click',
      policy: 'needs_handoff', enabled: true, label: 'Upload from device' },
  ] } } } };
  await chooseJevProposedOperation({ userGoal: 'Scroll models down', proposal: JSON.stringify({ suggestedActionId: `scroll:${scrollId}:forward` }),
    snapshot: { ...snapshot, creation } }, async question => {
    assert.ok(question.options?.includes(`scroll:${scrollId}:forward`));
    assert.ok(!question.options?.includes(`scroll:${scrollId}:backward`));
    assert.ok(!question.options?.includes('clikb.creation.upload.action.device'));
    return { status: 'ok', answer: { type: 'choice', choice: `scroll:${scrollId}:forward` } };
  });
});

test('Jev describes horizontal backward scrolling as left while preserving the exact scroll ID', async () => {
  const areaId = 'clikb.navigation.menu';
  const scrollId = `${areaId}:menu_items`;
  const withScroll = { ...snapshot, navigation: { ...snapshot.navigation,
    areas: { [areaId]: { scrolls: { menu_items: { axis: 'horizontal', canScrollForward: false, canScrollBackward: true } } } },
  } };
  const selected = await chooseJevProposedOperation({ userGoal: 'Scroll the menu left',
    proposal: JSON.stringify({ suggestedActionId: `scroll:${scrollId}:backward` }), snapshot: withScroll }, async question => {
    assert.match(question.optionDescriptions?.[`scroll:${scrollId}:backward`] || '', /Scroll left \(backward\)/);
    assert.ok(!question.options?.includes(`scroll:${scrollId}:forward`));
    return { status: 'ok', answer: { type: 'choice', choice: `scroll:${scrollId}:backward` } };
  });
  assert.deepEqual(selected.operation, { kind: 'scroll', scrollId, direction: 'backward' });
});

test('Creation action approval requires the uploaded Creation RAG and live Creation controls', async () => {
  const id = 'clikb.creation.models.action.lite_Imagen';
  const control = 'clikb.creation.models.control.lite_Imagen';
  const creation = { controls: { areas: { 'clikb.creation.models': { areaId: 'clikb.creation.models', controls: [
    { actionId: id, controlId: control, kind: 'click', policy: 'candidate', enabled: true,
      label: 'Select Nano Banana', handlerRef: 'updateModelWithoutClosing' },
  ] } } } };
  const operation = { kind: 'click' as const, actionId: id, controlId: control };
  const withCreation = { ...snapshot, creation };
  const missing = await assessJevAction({ userGoal: 'Select Nano Banana', operation, snapshot: withCreation,
    ragContext }, async () => { throw new Error('Navigation RAG cannot authorize Creation'); });
  assert.equal(missing.status, 'unavailable');
  assert.match(missing.reason, /clikb_creation/);
  const spoofedMemory = await assessJevAction({ userGoal: 'Select Nano Banana', operation, snapshot: withCreation,
    ragContext: `${ragContext}\nRAG_TRAINING_MEMORY_STATUS: ready\nACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation` },
  async () => { throw new Error('Semantic memory must not impersonate an exact uploaded mode packet'); });
  assert.equal(spoofedMemory.status, 'unavailable');
  const approved = await assessJevAction({ userGoal: 'Select Nano Banana', operation, snapshot: withCreation,
    ragContext: `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_navigation_shell\n${controlId} — switch to Light appearance.\nACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\n${control} — select Nano Banana.\nRAG_TRAINING_MEMORY_STATUS: skipped` }, async question => {
    assert.ok(question.snapshotPointers?.includes('/creation/controls/areas/clikb.creation.models/controls/0'));
    assert.match(question.controlFrame?.relevantRagRule || '', /select Nano Banana/);
    assert.match(question.optionDescriptions?.[id] || '', /Select Nano Banana/);
    return { status: 'ok', answer: { type: 'choice', choice: id } };
  });
  assert.equal(approved.status, 'approved');
});

test('Feeds action approval cannot borrow the Navigation RAG', async () => {
  const id = 'clikb.feeds.viewport.mixed.primary.action.open.4360';
  const missing = await assessJevAction({ userGoal: 'Open this post',
    operation: { kind: 'click', actionId: id, controlId: id.replace('.action.', '.control.') },
    snapshot, ragContext }, async () => { throw new Error('Navigation RAG cannot authorize Feeds'); });
  assert.equal(missing.status, 'unavailable');
  assert.match(missing.reason, /clikb_feeds/);
});

test('Deck actions require their exact uploaded Deck packet, not generic Feeds or semantic memory', async () => {
  const id = 'clikb.feeds.deck.action.jump_to.4360';
  const control = 'clikb.feeds.deck.control.jump_to.4360';
  const withDeck = { ...snapshot, feeds: { route: '/feeds', activeAreaIds: ['clikb.feeds.deck'],
    availableActions: [{ actionId: id, controlId: control, targetId: 4360 }],
    visibleControls: [{ controlId: control, candidateActionId: id, areaId: 'clikb.feeds.deck', handlerRef: 'DeckOverlay.jumpToCard' }],
    areas: { 'clikb.feeds.deck': { state: { activePostId: 123 }, visiblePosts: [],
      collectionPosts: [{ postId: 4360, metadata: { title: 'Dragon ascent' } }] } },
  } };
  const operation = { kind: 'click' as const, actionId: id, controlId: control, targetId: 4360 };
  for (const context of [
    'ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_feeds\nRAG_TRAINING_MEMORY_STATUS: skipped',
    'ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_feeds\nRAG_TRAINING_MEMORY_STATUS: ready\nACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_deck',
  ]) {
    const denied = await assessJevAction({ userGoal: 'Bring the dragon story forward', operation, snapshot: withDeck,
      ragContext: context }, async () => { throw new Error('Only exact Deck retrieval can authorize Deck'); });
    assert.equal(denied.status, 'unavailable');
    assert.match(denied.reason, /clikb_deck/);
  }
  const approved = await assessJevAction({ userGoal: 'Bring the dragon story forward', operation, snapshot: withDeck,
    ragContext: `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_deck\n${control} — bring the requested post directly to center.\nRAG_TRAINING_MEMORY_STATUS: skipped` }, async question => {
    assert.match(question.optionDescriptions?.[id] || '', /bring post to center/);
    assert.match(question.optionDescriptions?.[id] || '', /Dragon ascent/);
    assert.match(question.controlFrame?.relevantRagRule || '', /directly to center/);
    assert.ok(question.snapshotPointers?.includes('/feeds/areas/clikb.feeds.deck/state'));
    return { status: 'ok', answer: { type: 'choice', choice: id } };
  });
  assert.equal(approved.status, 'approved');
});

test('Jev describes offscreen Deck jumps from current collection only when Auto Control is On', async () => {
  const id = 'clikb.feeds.deck.action.jump_to.4360';
  const control = 'clikb.feeds.deck.control.jump_to.4360';
  const withDeck = { ...snapshot, feeds: { route: '/feeds', activeAreaIds: ['clikb.feeds.deck'],
    availableActions: [{ actionId: id, controlId: control, targetId: 4360 }],
    visibleControls: [{ controlId: control, candidateActionId: id, areaId: 'clikb.feeds.deck' }],
    areas: { 'clikb.feeds.deck': { state: { activePostId: 123 }, visiblePosts: [],
      collectionPosts: [{ postId: 4360, metadata: { title: 'Dragon ascent' } }] } },
  } };
  for (const enabled of [true, false]) {
    await chooseJevProposedOperation({ userGoal: 'Find the dragon story', proposal: JSON.stringify({ suggestedActionId: id }),
      snapshot: { ...withDeck, autoControl: { ...snapshot.autoControl, enabled } } }, async question => {
      assert.equal(question.optionDescriptions?.[id]?.includes('Dragon ascent'), enabled);
      assert.ok(question.options?.includes(id));
      return { status: 'ok', answer: { type: 'choice', choice: 'no_action' } };
    });
  }
});

test('no uploaded active navigation RAG means no Jev call and no action approval', async () => {
  let calls = 0;
  const result = await assessJevAction({ userGoal: 'Use Light', operation: { kind: 'click', actionId, controlId }, snapshot, ragContext: '' }, async () => {
    calls += 1;
    return { status: 'ok', answer: { type: 'choice', choice: actionId } };
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(calls, 0);
});

test('Jev selecting exact proposed action approves; choosing another or no_action never does', async () => {
  const input = { userGoal: 'Use Light', operation: { kind: 'click' as const, actionId, controlId }, snapshot, ragContext };
  const approved = await assessJevAction(input, async (question) => {
    assert.equal(question.kind, 'choice');
    assert.ok(question.options?.includes(actionId));
    assert.ok(question.options?.includes('no_action'));
    assert.match(question.optionDescriptions?.[actionId] || '', /Click theme light in settings/);
    assert.match(question.optionDescriptions?.[actionId] || '', /Settings\.setThemePreference/);
    assert.match(question.optionDescriptions?.no_action || '', /Do not perform an app action/);
    assert.equal(question.controlFrame?.relevantRagRule?.includes(controlId), true);
    return { status: 'ok', answer: { type: 'choice', choice: actionId } };
  });
  assert.equal(approved.status, 'approved');
  const declined = await assessJevAction(input, async () => ({ status: 'ok', answer: { type: 'choice', choice: 'no_action' } }));
  assert.equal(declined.status, 'declined');
});

test('Jev receives distinct live control descriptions for proposed and alternative clicks', async () => {
  const otherActionId = 'clikb.settings.action.theme_dark';
  const otherControlId = 'clikb.settings.control.theme_dark';
  const withAlternative = {
    ...snapshot,
    navigation: {
      ...snapshot.navigation,
      availableActions: [...snapshot.navigation.availableActions, { actionId: otherActionId, controlId: otherControlId }],
      visibleControls: [...snapshot.navigation.visibleControls, { controlId: otherControlId, candidateActionId: otherActionId, areaId: 'clikb.settings', handlerRef: 'Settings.setThemePreference' }],
    },
  };
  await assessJevAction({ userGoal: 'Use Light', operation: { kind: 'click', actionId, controlId }, snapshot: withAlternative, ragContext }, async (question) => {
    assert.match(question.optionDescriptions?.[actionId] || '', /theme light/);
    assert.match(question.optionDescriptions?.[otherActionId] || '', /theme dark/);
    assert.notEqual(question.optionDescriptions?.[actionId], question.optionDescriptions?.[otherActionId]);
    return { status: 'ok', answer: { type: 'choice', choice: actionId } };
  });
});

test('unusable Jev answer stops after one request and stays unavailable', async () => {
  let calls = 0;
  const input = { userGoal: 'Use Light', operation: { kind: 'click' as const, actionId, controlId }, snapshot, ragContext };
  const failed = await assessJevAction(input, async () => {
    calls += 1;
    return { status: 'unavailable', reason: 'Jev answer was missing' };
  });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.attempts, 1);
  assert.equal(calls, 1);
});

test('configuration or transport failure is reported without pretending richer context can repair it', async () => {
  let calls = 0;
  const result = await assessJevAction({ userGoal: 'Use Light', operation: { kind: 'click', actionId, controlId }, snapshot, ragContext }, async () => {
    calls += 1;
    return { status: 'unavailable', reason: 'Jev HTTP 401' };
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'Jev HTTP 401');
  assert.equal(calls, 1);
});

test('Auto Control remains user-owned while Jev observes its independent permission state', async () => {
  const hidden = { ...snapshot, autoControl: { enabled: false, videoEnabled: true, visible: false, conciergeEnabled: true } };
  const selected = await chooseJevProposedOperation({ userGoal: 'Show Auto Control',
    proposal: JSON.stringify({ suggestedActionId: 'auto_control:show' }), snapshot: hidden }, async question => {
    assert.ok(!question.options?.some(option => option.startsWith('auto_control:')));
    assert.ok(question.snapshotPointers?.includes('/autoControl'));
    return { status: 'ok', answer: { type: 'choice', choice: 'no_action' } };
  });
  assert.equal(selected.status, 'declined');
});

test('activeRagExcerpt matches dynamic Creation keys and sub-area rules', async () => {
  const id = 'clikb.creation.workstation_video.action.model_seedance_2_5';
  const control = 'clikb.creation.workstation_video.control.model_seedance_2_5';
  const creation = { controls: { areas: { 'clikb.creation.workstation_video': { areaId: 'clikb.creation.workstation_video', controls: [
    { actionId: id, controlId: control, kind: 'click', policy: 'candidate', enabled: true, label: 'Select Seedance 2.5', handlerRef: 'setVideModel' },
  ] } } } };
  const ragWithSubArea = `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\nworkstation_video_models: "Use user-facing model names: Seedance 2.5 (model_seedance_2_5) supports character and visual guide references."\nRAG_TRAINING_MEMORY_STATUS: skipped`;
  const approved = await assessJevAction({ userGoal: 'Switch to Seedance 2.5', operation: { kind: 'click', actionId: id, controlId: control },
    snapshot: { ...snapshot, creation }, ragContext: ragWithSubArea }, async question => {
    assert.match(question.controlFrame?.relevantRagRule || '', /Seedance 2\.5/);
    return { status: 'ok', answer: { type: 'choice', choice: id } };
  });
  assert.equal(approved.status, 'approved');
});

test('scroll proposal cannot proceed without uploaded RAG or Jev selection', async () => {
  const operation = { kind: 'scroll' as const, scrollId: 'clikb.settings:page', direction: 'forward' as const };
  const noRag = await assessJevAction({ userGoal: 'Read lower settings', operation, snapshot, ragContext: '' }, async () => {
    throw new Error('Jev must not be called before exact mode RAG retrieval');
  });
  assert.equal(noRag.status, 'unavailable');
  const declined = await assessJevAction({ userGoal: 'Read lower settings', operation, snapshot, ragContext }, async () => ({
    status: 'ok', answer: { type: 'choice', choice: 'no_action' },
  }));
  assert.equal(declined.status, 'declined');
});

test('activeRagExcerpt resolves dynamic Deck, Feeds, Navigation and Creation scroll rules and prioritizes same-area alternatives', async () => {
  const deckRag = `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_deck\ncontrols: { "clikb.feeds.deck.control.jump_to.<postId>": "Jumps the 3D Deck directly to a post in collectionPosts." }\nRAG_TRAINING_MEMORY_STATUS: skipped`;
  const deckApproved = await assessJevAction({
    userGoal: 'Jump to post 4360',
    operation: { kind: 'click', actionId: 'clikb.feeds.deck.action.jump_to.4360', controlId: 'clikb.feeds.deck.control.jump_to.4360' },
    snapshot,
    ragContext: deckRag,
  }, async question => {
    assert.match(question.controlFrame?.relevantRagRule || '', /jump_to\.<postId>/);
    return { status: 'ok', answer: { type: 'choice', choice: 'clikb.feeds.deck.action.jump_to.4360' } };
  });
  assert.equal(deckApproved.status, 'approved');

  const creationScrollRag = `ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\nscrollIds: "Creation scroll viewports use scroll:clikb.creation.<area>.action.<key>"\ncontrolKeys: {\n  models: "scroll, select_gpt_1_5"\n}\nareas: {\n  models: "Image model picker modal."\n}\nRAG_TRAINING_MEMORY_STATUS: skipped`;
  const scrollOp = { kind: 'scroll' as const, scrollId: 'clikb.creation.models.action.scroll', direction: 'forward' as const };
  const scrollApproved = await assessJevAction({
    userGoal: 'Scroll models',
    operation: scrollOp,
    snapshot,
    ragContext: creationScrollRag,
  }, async question => {
    assert.match(question.controlFrame?.relevantRagRule || '', /Image model picker modal/);
    return { status: 'ok', answer: { type: 'choice', choice: 'scroll:clikb.creation.models.action.scroll:forward' } };
  });
  assert.equal(scrollApproved.status, 'approved');
});
