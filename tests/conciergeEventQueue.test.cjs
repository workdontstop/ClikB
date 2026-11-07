const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');

const {
  ConciergeEventQueue,
  CONCIERGE_SETTLE_MS,
  CONCIERGE_MID_RUN_COOLDOWN_MS,
  CONCIERGE_NAVIGATION_COOLDOWN_MS,
  buildMilestoneObservationPrompt,
} = load('src/conciergeEventQueue.ts');

const brainstormSliceModule = load('src/brainstormSlice.ts');
const brainstormReducer = brainstormSliceModule.default;
const {
  patchUserSnapshot,
  recordCreationAttemptStart,
  recordCreationAttemptSuccess,
  recordCreationAttemptFailure,
} = brainstormSliceModule;

function makeSlot(sceneNumber, overrides = {}) {
  return {
    slotKey: `scene:${sceneNumber}`,
    sceneNumber,
    bShotNumber: null,
    hasPreviewImage: false,
    hasHdImage: false,
    hasVideo: false,
    previewVersion: null,
    hdVersion: null,
    videoVersion: null,
    ...overrides,
  };
}

function baseSnapshot(overrides = {}) {
  return {
    route: '/Create',
    ui: { minimisePrompt: false },
    autoControl: { enabled: true, visible: true, conciergeEnabled: true },
    navigation: { route: '/Create', recentTransitions: [] },
    feeds: { activeAreaIds: [], areas: {} },
    creation: {
      isActive: true,
      projectId: 'pirate-story',
      stage: 'storybook',
      mode: 'cinema',
      isGenerating: true,
      previewSceneCount: 9,
      previewImageCount: 0,
      hdImageCount: 0,
      videoCount: 0,
      characterBranchStage: 'none',
      editStoryIsOpen: false,
      referenceImageReadyCount: 0,
      referenceImageMissingCount: 0,
      sceneSlots: Array.from({ length: 9 }, (_, i) => makeSlot(i + 1)),
      activeAttemptsByTarget: {},
      confirmedFailuresByTarget: {},
      recentMediaChanges: [],
      ...(overrides.creation || {}),
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'creation')),
  };
}

test('Scene 1 completion wakes promptly while Scene 2 is still generating, then enforces mid-run cooldown without dropping later scenes', () => {
  const initial = baseSnapshot();
  const queue = new ConciergeEventQueue(initial);

  // Scene 1 finishes at t=1000 while Scene 2..9 are still generating
  const scene1Done = baseSnapshot({
    creation: {
      isGenerating: true,
      hdImageCount: 1,
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        i === 0
          ? makeSlot(1, { hasHdImage: true, hdVersion: 'https://cdn/s1-v1.png' })
          : makeSlot(i + 1),
      ),
    },
  });
  const added1 = queue.observe(scene1Done, 1000);
  assert.equal(added1.length, 1);
  assert.equal(added1[0].kind, 'scene_hd_ready');
  assert.equal(added1[0].sceneNumber, 1);

  // Settle window not yet elapsed at t=1100
  assert.equal(
    queue.takeDueBatch(1100, { voiceOutputOrInputBusy: false, streaming: false }),
    null,
  );

  // Wakes promptly at t=1000 + CONCIERGE_SETTLE_MS even though isGenerating === true
  const batch1 = queue.takeDueBatch(1000 + CONCIERGE_SETTLE_MS, {
    voiceOutputOrInputBusy: false,
    streaming: false,
  });
  assert.ok(batch1);
  assert.deepEqual(batch1.events.map((e) => e.sceneNumber), [1]);
  queue.resolveBatch(batch1.batchId, {
    deliveredText: 'Scene 1 just landed!',
    completedCleanly: true,
    now: 1500,
  });

  // Scene 2 finishes at t=3000 while still generating (< 8s cooldown from t=1500)
  const scene2Done = baseSnapshot({
    creation: {
      isGenerating: true,
      hdImageCount: 2,
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        i <= 1
          ? makeSlot(i + 1, { hasHdImage: true, hdVersion: `https://cdn/s${i + 1}-v1.png` })
          : makeSlot(i + 1),
      ),
    },
  });
  queue.observe(scene2Done, 3000);
  assert.equal(
    queue.takeDueBatch(3500, { voiceOutputOrInputBusy: false, streaming: false }),
    null,
    'Mid-run cooldown prevents chatter every few seconds while still generating',
  );
  assert.equal(queue.getPendingEvents().length, 1, 'Scene 2 remains retained in pending');

  // Once cooldown elapses, Scene 2 is delivered cleanly
  const batch2 = queue.takeDueBatch(1500 + CONCIERGE_MID_RUN_COOLDOWN_MS + 100, {
    voiceOutputOrInputBusy: false,
    streaming: false,
  });
  assert.ok(batch2);
  assert.deepEqual(batch2.events.map((e) => e.sceneNumber), [2]);
});

test('9-scene initial burst and 9-scene same-slot replacement burst (>8) retain all 9 slots while TTS playback is busy', () => {
  const queue = new ConciergeEventQueue(baseSnapshot());

  // Burst 1: All 9 scenes finish at once while recentMediaChanges only kept the last 8 (Scenes 2..9)
  // AND voice playback is currently speaking (voiceOutputOrInputBusy: true)
  const all9Ready = baseSnapshot({
    creation: {
      isGenerating: false,
      hdImageCount: 9,
      recentMediaChanges: Array.from({ length: 8 }, (_, idx) => ({
        kind: 'hd_image',
        targetKey: `scene:${idx + 2}`,
      })),
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        makeSlot(i + 1, { hasHdImage: true, hdVersion: `https://cdn/s${i + 1}-v1.png` }),
      ),
    },
  });
  queue.observe(all9Ready, 2000);

  // Held while Fish TTS is speaking — zero drops!
  assert.equal(
    queue.takeDueBatch(2500, { voiceOutputOrInputBusy: true, streaming: false }),
    null,
  );
  assert.equal(queue.getPendingEvents().length, 9);

  // Playback finishes -> all 9 scenes (including Scene 1!) dispatch in one batch
  const initialBatch = queue.takeDueBatch(2600, { voiceOutputOrInputBusy: false, streaming: false });
  assert.ok(initialBatch);
  assert.deepEqual(
    initialBatch.events.map((e) => [e.kind, e.sceneNumber]),
    Array.from({ length: 9 }, (_, i) => ['scene_hd_ready', i + 1]),
  );
  queue.resolveBatch(initialBatch.batchId, {
    deliveredText: 'All 9 scenes are ready!',
    completedCleanly: true,
    now: 3000,
  });

  // Burst 2: All 9 already-populated HD slots get replaced at once (hdVersion v1 -> v2)
  const all9Replaced = baseSnapshot({
    creation: {
      isGenerating: false,
      hdImageCount: 9,
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        makeSlot(i + 1, { hasHdImage: true, hdVersion: `https://cdn/s${i + 1}-v2.png` }),
      ),
    },
  });
  queue.observe(all9Replaced, 4000);
  const replacementBatch = queue.takeDueBatch(4500, { voiceOutputOrInputBusy: false, streaming: false });
  assert.ok(replacementBatch);
  assert.deepEqual(
    replacementBatch.events.map((e) => [e.kind, e.sceneNumber]),
    Array.from({ length: 9 }, (_, i) => ['scene_hd_updated', i + 1]),
  );
});

test('preview and HD readiness stay distinct when spoken separately, and coalesce when HD lands before preview is spoken', () => {
  const queue = new ConciergeEventQueue(baseSnapshot());

  // Case A: Scene 1 preview lands and is spoken; subsequent HD render on Scene 1 still emits scene_hd_ready
  const s1Preview = baseSnapshot({
    creation: {
      sceneSlots: [
        makeSlot(1, { hasPreviewImage: true, previewVersion: 'prev-1' }),
        ...Array.from({ length: 8 }, (_, i) => makeSlot(i + 2)),
      ],
    },
  });
  queue.observe(s1Preview, 1000);
  const b1 = queue.takeDueBatch(1400, { voiceOutputOrInputBusy: false, streaming: false });
  assert.equal(b1.events.length, 1);
  assert.equal(b1.events[0].kind, 'scene_preview_ready');
  queue.resolveBatch(b1.batchId, { deliveredText: 'Scene 1 preview is up.', completedCleanly: true, now: 1500 });

  // Case B: Scene 1 upgrades to HD AND Scene 2 gets preview while busy, then Scene 2 upgrades to HD before dispatch
  const s1HdAndS2Preview = baseSnapshot({
    creation: {
      isGenerating: false,
      hdImageCount: 1,
      sceneSlots: [
        makeSlot(1, { hasPreviewImage: true, previewVersion: 'prev-1', hasHdImage: true, hdVersion: 'hd-1' }),
        makeSlot(2, { hasPreviewImage: true, previewVersion: 'prev-2' }),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(i + 3)),
      ],
    },
  });
  queue.observe(s1HdAndS2Preview, 2000);

  const s2UpgradedBeforeDispatch = baseSnapshot({
    creation: {
      isGenerating: false,
      hdImageCount: 2,
      sceneSlots: [
        makeSlot(1, { hasPreviewImage: true, previewVersion: 'prev-1', hasHdImage: true, hdVersion: 'hd-1' }),
        makeSlot(2, { hasPreviewImage: true, previewVersion: 'prev-2', hasHdImage: true, hdVersion: 'hd-2' }),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(i + 3)),
      ],
    },
  });
  queue.observe(s2UpgradedBeforeDispatch, 2100);

  const b2 = queue.takeDueBatch(2500, { voiceOutputOrInputBusy: false, streaming: false });
  assert.ok(b2);
  assert.deepEqual(
    b2.events.map((e) => [e.kind, e.sceneNumber]),
    [
      ['scene_hd_ready', 1],
      ['scene_hd_ready', 2],
    ],
    'Spoken preview did not block Scene 1 HD, while unspoken Scene 2 preview coalesced into Scene 2 HD',
  );
});

test('partial delivery retires only covered events: "Your..." retires 0/9, "Scene 1 is ready, and" retires Scene 1 only', () => {
  const queue = new ConciergeEventQueue(baseSnapshot());
  const all9Ready = baseSnapshot({
    creation: {
      isGenerating: false,
      hdImageCount: 9,
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        makeSlot(i + 1, { hasHdImage: true, hdVersion: `https://cdn/s${i + 1}.png` }),
      ),
    },
  });
  queue.observe(all9Ready, 1000);

  // Interruption 1: Barge-in right after "Your..." — 0 events covered!
  const batch1 = queue.takeDueBatch(1400, { voiceOutputOrInputBusy: false, streaming: false });
  assert.equal(batch1.events.length, 9);
  const res1 = queue.resolveBatch(batch1.batchId, {
    deliveredText: 'Your...',
    speechStarted: true,
    completedCleanly: false,
    now: 1500,
  });
  assert.equal(res1.acknowledgedIds.length, 0, '"Your..." must not retire any of the 9 scene completions');
  assert.equal(res1.requeuedIds.length, 9);

  // Interruption 2: Resumes and is interrupted after "Scene 1 is ready, and" — retires Scene 1 ONLY!
  const batch2 = queue.takeDueBatch(1900, { voiceOutputOrInputBusy: false, streaming: false });
  assert.equal(batch2.events.length, 9);
  assert.deepEqual(batch2.interruptedPrefixes, ['Your...']);
  assert.match(buildMilestoneObservationPrompt(batch2), /do NOT repeat that phrase verbatim/);

  const res2 = queue.resolveBatch(batch2.batchId, {
    deliveredText: 'Scene 1 is ready, and',
    speechStarted: true,
    completedCleanly: false,
    now: 2100,
  });
  assert.equal(res2.acknowledgedIds.length, 1);
  assert.equal(res2.requeuedIds.length, 8);

  // Remaining pending events are strictly Scenes 2..9, with anti-verbatim-replay history preserved
  const batch3 = queue.takeDueBatch(2500, { voiceOutputOrInputBusy: false, streaming: false });
  assert.deepEqual(batch3.events.map((e) => e.sceneNumber), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(batch3.interruptedPrefixes.at(-1), 'Scene 1 is ready, and');
  assert.match(buildMilestoneObservationPrompt(batch3), /Scene 1 is ready, and/);
});

test('post-task manual transitions (Characters, Games) stay observable when task === null and Auto Control is Off, and user turns prevent REC 74 -> 75 stale blurts', () => {
  const finishedPirates = baseSnapshot({
    autoControl: { enabled: false, visible: true, conciergeEnabled: true },
    creation: {
      isActive: true,
      isGenerating: false,
      hdImageCount: 4,
      sceneSlots: Array.from({ length: 4 }, (_, i) =>
        makeSlot(i + 1, { hasHdImage: true, hdVersion: `pirate-${i + 1}` }),
      ),
    },
  });
  const queue = new ConciergeEventQueue(finishedPirates);

  // 1. Task is finished (isGenerating: false, autoControl: Off); user opens Character Studio
  const openedCharacters = baseSnapshot({
    autoControl: { enabled: false, visible: true, conciergeEnabled: true },
    creation: {
      ...finishedPirates.creation,
      characterBranchStage: 'characters',
    },
  });
  const charEvents = queue.observe(openedCharacters, 5000);
  assert.equal(charEvents.length, 1);
  assert.equal(charEvents[0].kind, 'creation_stage_transition');
  assert.equal(charEvents[0].stage, 'characters');
  assert.equal(charEvents[0].commentaryWorthy, true);

  const charBatch = queue.takeDueBatch(5400, {
    voiceOutputOrInputBusy: false,
    streaming: false,
    activeTaskDrivingUi: false,
  });
  assert.ok(charBatch, 'Post-task Character Studio transition wakes read-only observation even when Auto Control is Off');
  queue.resolveBatch(charBatch.batchId, {
    deliveredText: 'Opening Character Studio for your pirate cast!',
    completedCleanly: true,
    now: 5500,
  });

  // 2. User closes Creation and manually switches to Games (/interactions)
  const movedToGames = baseSnapshot({
    route: '/interactions',
    autoControl: { enabled: false, visible: true, conciergeEnabled: true },
    navigation: {
      route: '/interactions',
      recentTransitions: [
        { sequence: 1, actor: 'manual', outcome: 'changed', before: { route: '/Create' }, after: { route: '/interactions' } },
      ],
    },
    creation: {
      ...openedCharacters.creation,
      isActive: false,
    },
  });
  const navEvents = queue.observe(movedToGames, 5500 + CONCIERGE_NAVIGATION_COOLDOWN_MS + 100);
  assert.ok(navEvents.some((e) => e.kind === 'manual_navigation' && e.commentaryWorthy));

  // Before automatic timer fires, the user speaks directly (REC 74): takeForUserTurn folds pending events into the user turn
  const foldedIntoUserTurn = queue.takeForUserTurn(8500);
  assert.ok(foldedIntoUserTurn);
  assert.ok(foldedIntoUserTurn.events.some((e) => e.kind === 'manual_navigation'));
  queue.resolveBatch(foldedIntoUserTurn.batchId, {
    deliveredText: 'Welcome to Interactions! Want to build a playable pirate scene?',
    completedCleanly: true,
    now: 9000,
  });

  // After the user turn finishes, no stale automatic blurt (REC 75) remains queued!
  assert.equal(
    queue.takeDueBatch(9500, { voiceOutputOrInputBusy: false, streaming: false }),
    null,
  );
});

test('attempt-owned failure reducer ignores superseded callbacks and preserves concurrent slot failures', () => {
  let state = brainstormReducer(
    undefined,
    patchUserSnapshot({
      creation: { projectId: 'proj-a', isActive: true, isGenerating: true },
    }),
  );

  // Scene 2 starts attempt-1, then user immediately restarts Scene 2 with attempt-2
  state = brainstormReducer(
    state,
    recordCreationAttemptStart({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      sceneNumber: 2,
      attemptId: 'attempt-1',
      startedAt: 1000,
    }),
  );
  state = brainstormReducer(
    state,
    recordCreationAttemptStart({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      sceneNumber: 2,
      attemptId: 'attempt-2',
      startedAt: 1100,
    }),
  );
  // Scene 5 also starts attempt-5 concurrently
  state = brainstormReducer(
    state,
    recordCreationAttemptStart({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:4',
      sceneNumber: 5,
      attemptId: 'attempt-5',
      startedAt: 1150,
    }),
  );

  // Late failure callback from superseded attempt-1 arrives -> MUST BE IGNORED!
  state = brainstormReducer(
    state,
    recordCreationAttemptFailure({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      sceneNumber: 2,
      attemptId: 'attempt-1',
      message: 'Superseded network abort',
      failedAt: 1200,
    }),
  );
  assert.equal(
    Object.keys(state.userSnapshot.creation.confirmedFailuresByTarget || {}).length,
    0,
    'Superseded attempt-1 callback cannot record a false failure over attempt-2',
  );

  // Now active attempt-2 (Scene 2) and attempt-5 (Scene 5) both fail -> BOTH coexist!
  state = brainstormReducer(
    state,
    recordCreationAttemptFailure({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      sceneNumber: 2,
      attemptId: 'attempt-2',
      message: 'Scene 2 provider timeout',
      failedAt: 1300,
    }),
  );
  state = brainstormReducer(
    state,
    recordCreationAttemptFailure({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:4',
      sceneNumber: 5,
      attemptId: 'attempt-5',
      message: 'Scene 5 safety filter',
      failedAt: 1350,
    }),
  );

  const failures = state.userSnapshot.creation.confirmedFailuresByTarget;
  assert.ok(failures['proj-a:image:A:1']);
  assert.ok(failures['proj-a:image:A:4']);
  assert.equal(failures['proj-a:image:A:1'].attemptId, 'attempt-2');
  assert.equal(failures['proj-a:image:A:4'].attemptId, 'attempt-5');

  // Event queue emits distinct generation_failed events for both concurrent failures
  const queue = new ConciergeEventQueue(baseSnapshot({ creation: { projectId: 'proj-a' } }));
  const emitted = queue.observe(state.userSnapshot, 1400).filter((e) => e.kind === 'generation_failed');
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.map((e) => e.sceneNumber).sort(), [2, 5]);

  // Retry succeeds on Scene 2 -> clears Scene 2 failure while preserving Scene 5 failure
  state = brainstormReducer(
    state,
    recordCreationAttemptStart({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      sceneNumber: 2,
      attemptId: 'attempt-3',
      startedAt: 1500,
    }),
  );
  state = brainstormReducer(
    state,
    recordCreationAttemptSuccess({
      projectId: 'proj-a',
      mediaKind: 'image',
      targetKey: 'A:1',
      attemptId: 'attempt-3',
    }),
  );
  assert.equal(state.userSnapshot.creation.confirmedFailuresByTarget['proj-a:image:A:1'], undefined);
  assert.ok(state.userSnapshot.creation.confirmedFailuresByTarget['proj-a:image:A:4']);

  // Switching to a new project clears prior project's failures cleanly
  state = brainstormReducer(
    state,
    patchUserSnapshot({ creation: { projectId: 'proj-b', isActive: true } }),
  );
  assert.equal(state.userSnapshot.creation.confirmedFailuresByTarget, undefined);
});

test('Auto Control Off suppresses takeDueBatch from initiating autonomous commentary, while preserving direct user turn context', () => {
  const initial = baseSnapshot({
    autoControl: { enabled: false, visible: true, conciergeEnabled: true },
  });
  const queue = new ConciergeEventQueue(initial);

  const scene1Done = baseSnapshot({
    autoControl: { enabled: false, visible: true, conciergeEnabled: true },
    creation: {
      isGenerating: false,
      hdImageCount: 1,
      sceneSlots: Array.from({ length: 9 }, (_, i) =>
        i === 0
          ? makeSlot(1, { hasHdImage: true, hdVersion: 'https://cdn/s1-v1.png' })
          : makeSlot(i + 1),
      ),
    },
  });
  const added = queue.observe(scene1Done, 2000);
  assert.equal(added.length, 1);
  assert.equal(added[0].kind, 'scene_hd_ready');

  // When autoControlEnabled is false, takeDueBatch returns null (autonomous commentary suppressed)
  const suppressedBatch = queue.takeDueBatch(3000, {
    voiceOutputOrInputBusy: false,
    streaming: false,
    autoControlEnabled: false,
  });
  assert.equal(suppressedBatch, null, 'takeDueBatch must be silenced when Auto Control is off');

  // Direct user turn still folds the milestone events cleanly with full context
  const userTurnBatch = queue.takeForUserTurn(3100);
  assert.ok(userTurnBatch, 'Direct chat turn receives the pending event context');
  assert.equal(userTurnBatch.events[0].kind, 'scene_hd_ready');
});

