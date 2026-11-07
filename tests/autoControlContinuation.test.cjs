const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/autoControlContinuation.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const instance = new Module(filename, module);
instance._compile(compiled, filename);
const continuation = instance.exports;

test('an explicitly observed unchanged wait makes zero model wakeups; new state and real Continue remain actionable', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Generate two images and stop at Publish');
  continuation.noteAutoControlGateStage('task_waiting', { waitForChange: true }, 'job-running');
  const query = currentSnapshotKey => continuation.shouldWakeAutoControlHeartbeat({
    task: continuation.getAutoControlTask(), now: Date.now() + 10000, running: false, quietUntil: 0,
    lastPingAt: 0, lastRunRevision: -1, currentSnapshotKey, lastSnapshotKey: 'before-dispatch',
    unchangedChecks: 0, maxUnchangedChecks: 1,
  });
  assert.equal(query('job-running').shouldWake, false);
  assert.equal(query('images-ready').shouldWake, true);
  continuation.noteAutoControlUserTurn('continue');
  assert.equal(query('job-running').shouldWake, true);
  continuation.clearAutoControlTask();
});

test('waiting before the first action can wake; completed task stops all continuation', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Wait for the model picker then select Nano Banana Pro');
  continuation.noteAutoControlGateStage('task_waiting');
  continuation.idleAutoControlTask();
  assert.equal(continuation.getAutoControlTask().waiting, true);
  assert.equal(continuation.getAutoControlTask().pending, false);
  continuation.noteAutoControlGateStage('task_completed');
  assert.equal(continuation.getAutoControlTask(), null);
});

test('recoverable failure resumes but refusal pauses, and explicit retry retains the goal', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Select Nano Banana Pro');
  continuation.noteAutoControlGateStage('intent_unavailable');
  assert.equal(continuation.getAutoControlTask().paused, true);
  continuation.noteAutoControlGateStage('recoverable_failure');
  assert.equal(continuation.getAutoControlTask().paused, false);
  continuation.noteAutoControlGateStage('jev_declined');
  assert.equal(continuation.getAutoControlTask().paused, true);
  continuation.noteAutoControlUserTurn('try again');
  assert.equal(continuation.getAutoControlTask().goal, 'Select Nano Banana Pro');
  assert.equal(continuation.getAutoControlTask().pending, true);
  assert.equal(continuation.getAutoControlTask().paused, false);
  continuation.noteAutoControlUserTurn('stop');
  assert.equal(continuation.getAutoControlTask(), null);
});

test('Creation dispatch can wait for asynchronous work without claiming success', () => {
  continuation.noteAutoControlUserTurn('Generate the confirmed video and wait for it');
  continuation.noteAutoControlGateStage('handler_dispatched');
  assert.equal(continuation.getAutoControlTask().waiting, true);
  continuation.idleAutoControlTask();
  assert.equal(continuation.getAutoControlTask().pending, false);
  continuation.noteAutoControlGateStage('action_blocked');
  assert.equal(continuation.getAutoControlTask().paused, true);
  assert.equal(continuation.getAutoControlTask().pending, false);
});

test('questions retain the complete creative brief and explicit boundaries', () => {
  continuation.clearAutoControlTask();
  const brief = 'Create one image. Skip characters. ' + 'A detailed scene. '.repeat(100) + 'Stop before publishing.';
  continuation.noteAutoControlUserTurn(brief);
  continuation.noteAutoControlGateStage('handler_dispatched');
  continuation.noteAutoControlUserTurn('What does my current prompt say?');
  continuation.clearPendingAutoControlUserTurn();
  assert.equal(continuation.getAutoControlTask().goal, brief);
  assert.equal(continuation.getAutoControlTask().latestUserText, 'What does my current prompt say?');
  continuation.noteAutoControlUserTurn('Change the image model to Nano Banana Pro');
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.ok(continuation.getAutoControlTask().goal.includes('Stop before publishing.'));
  assert.ok(continuation.getAutoControlTask().goal.endsWith('Change the image model to Nano Banana Pro'));
  continuation.noteAutoControlUserTurn('Can you enable Video permission?');
  continuation.noteAutoControlGateStage('permission_required');
  assert.ok(continuation.getAutoControlTask().goal.endsWith('Can you enable Video permission?'));
  assert.ok(continuation.getAutoControlTask().goal.includes('Stop before publishing.'));
});

test('ordinary chat never arms background work', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Hello, how is your day?');
  assert.equal(continuation.getAutoControlTask(),null);
  continuation.clearPendingAutoControlUserTurn();
  continuation.noteAutoControlUserTurn('Why can it not generate?');
  assert.equal(continuation.getAutoControlTask(),null);
  continuation.clearPendingAutoControlUserTurn();
  continuation.noteAutoControlUserTurn('A neon cyberpunk samurai walking through rainy Tokyo at night');
  continuation.noteAutoControlGateStage('task_waiting');
  assert.equal(continuation.getAutoControlTask().goal, 'A neon cyberpunk samurai walking through rainy Tokyo at night');
  continuation.noteAutoControlUserTurn('I really enjoy rainy weather');
  continuation.clearPendingAutoControlUserTurn();
  assert.equal(continuation.getAutoControlTask().goal, 'A neon cyberpunk samurai walking through rainy Tokyo at night');
  // Even if passive task_waiting / recovery_assessed fires during a companion reply while a task is already active,
  // the uncommitted conversational turn must not be committed into goal:
  continuation.idleAutoControlTask();
  continuation.noteAutoControlUserTurn('Nice weather in the story too!');
  continuation.noteAutoControlGateStage('task_waiting');
  continuation.clearPendingAutoControlUserTurn();
  assert.equal(continuation.getAutoControlTask().goal, 'A neon cyberpunk samurai walking through rainy Tokyo at night');
  assert.equal(continuation.getAutoControlTask().waiting, true);
  // Even if Concierge proposes a tool call ('triggered') before Jev classifies the turn as 'content_or_conversation',
  // pendingUserTurn must not commit on 'triggered' and must be discarded without pausing the active task:
  continuation.noteAutoControlUserTurn('By the way I love synthwave music');
  continuation.noteAutoControlGateStage('triggered');
  continuation.noteAutoControlGateStage('content_or_conversation');
  continuation.noteAutoControlGateStage('action_blocked', { reason: 'content_or_conversation' });
  assert.equal(continuation.getAutoControlTask().goal, 'A neon cyberpunk samurai walking through rainy Tokyo at night');
  assert.equal(continuation.getAutoControlTask().waiting, true);
  assert.equal(continuation.getAutoControlTask().paused, false);
  // Greeting-prefixed requests and polite "Can you animate/close..." requests retain tasks via gate stages with zero regex whitelists:
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Hey, create two dinosaur images');
  continuation.noteAutoControlGateStage('handler_dispatched');
  assert.equal(continuation.getAutoControlTask().goal, 'Hey, create two dinosaur images');
  continuation.noteAutoControlUserTurn('Can you animate these images?');
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.ok(continuation.getAutoControlTask().goal.endsWith('Can you animate these images?'));
});

test('a meaningful manual/media change wakes a state-blocked task but permission and user boundaries stay paused', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Create Cinema and stop before publishing');
  continuation.noteAutoControlGateStage('action_blocked',{status:'state_blocked',recovery:'state_change'},'before');
  continuation.resumeAutoControlTask('before');
  assert.equal(continuation.getAutoControlTask().paused,true);
  continuation.resumeAutoControlTask('after');
  assert.equal(continuation.getAutoControlTask().paused,false);
  assert.equal(continuation.getAutoControlTask().pending,true);
  assert.match(continuation.getAutoControlTask().goal,/stop before publishing/);
  for(const stage of ['permission_required','confirmation_required','action_blocked']) {
    continuation.noteAutoControlGateStage(stage,{reason:'User refused'},'after');
    continuation.resumeAutoControlTask('new state');
    assert.equal(continuation.getAutoControlTask().paused,true,stage);
  }
});

test('semantic wakeups ignore version/timestamp churn and detect media readiness or newly mounted controls', () => {
  const before={route:'/feeds',timestamp:1,navigation:{stateVersion:1},creation:{stage:'scene-review',isGenerating:true,hdImageCount:0,controls:{stateVersion:1,areas:{}}}};
  const churn={...before,timestamp:99,navigation:{stateVersion:99},creation:{...before.creation,controls:{stateVersion:99,areas:{}}}};
  assert.equal(continuation.autoControlSnapshotKey(before),continuation.autoControlSnapshotKey(churn));
  assert.notEqual(continuation.autoControlSnapshotKey(before),continuation.autoControlSnapshotKey({...before,creation:{...before.creation,isGenerating:false,hdImageCount:1}}));
  assert.notEqual(continuation.autoControlSnapshotKey(before),continuation.autoControlSnapshotKey({...before,creation:{...before.creation,controls:{areas:{start:{state:{ready:true},controls:[{actionId:'clikb.creation.storybook_start.action.start',enabled:true}]}}}}}));
});

test('generation evidence survives later state wakeups and user follow-ups until task replacement', () => {
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn('Create a recap and stop before Publish');
  const evidence = { operation: {kind:'click',actionId:'clikb.creation.workstation_image.action.generate'},
    status:'timeout',mutationSent:true,executionScope:'a'.repeat(64) };
  continuation.noteAutoControlGateStage('action_blocked',{status:'execution_unknown',recovery:'state_change',evidence},'before');
  continuation.resumeAutoControlTask('after');
  continuation.noteAutoControlUserTurn('Continue');
  assert.deepEqual(continuation.getAutoControlTask().operationHistory,[evidence]);
  continuation.noteAutoControlUserTurn('What is happening?');
  continuation.clearPendingAutoControlUserTurn();
  assert.deepEqual(continuation.getAutoControlTask().operationHistory,[evidence]);
  assert.equal(continuation.getAutoControlTask().generationRevision,0);
  continuation.noteAutoControlUserTurn('Give me another take of this shot');
  assert.equal(continuation.autoControlRequestContext('').activeGenerationRevision,1,'any committed user refinement after generation evidence stages a new generation revision without a verb regex');
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.equal(continuation.getAutoControlTask().generationRevision,1,'explicit replacement creates a new generation request');
  continuation.noteAutoControlUserTurn('Continue');
  assert.equal(continuation.getAutoControlTask().generationRevision,1,'a continuation cannot create another replacement request');
  continuation.noteAutoControlUserTurn('try again');
  assert.equal(continuation.getAutoControlTask().generationRevision,2,'explicit try again increments generationRevision so a retry is never blocked');
  continuation.noteAutoControlUserTurn('New task: create a different story');
  assert.deepEqual(continuation.autoControlRequestContext('').activeAutoControlEvidence,[]);
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.deepEqual(continuation.getAutoControlTask().operationHistory,[]);
  assert.equal(continuation.getAutoControlTask().generationRevision,0);
});

test('billing deductions, pixel balance updates, and TTS state never trigger continuation wakeups', () => {
  const base = {
    route: '/Create',
    creation: {
      stage: 'storybook',
      isGenerating: false,
      hdImageCount: 2,
      controls: {
        areas: {
          'clikb.creation.storybook_toolbar': {
            state: { ready: true, pixels: 100, meteredDeduction: 0, ttsPlaying: false },
            controls: [
              { actionId: 'clikb.creation.storybook_toolbar.action.pixels_balance', policy: 'information_only', enabled: false, valueHint: '100 P', valueLength: 5 },
              { actionId: 'clikb.creation.storybook_toolbar.action.open_models', enabled: true },
            ],
          },
        },
      },
    },
  };
  const afterBillingTick = {
    ...base,
    creation: {
      ...base.creation,
      controls: {
        areas: {
          'clikb.creation.storybook_toolbar': {
            state: { ready: true, pixels: 77, meteredDeduction: 23, ttsPlaying: true },
            controls: [
              { actionId: 'clikb.creation.storybook_toolbar.action.pixels_balance', policy: 'information_only', enabled: false, valueHint: '77 P', valueLength: 4 },
              { actionId: 'clikb.creation.storybook_toolbar.action.open_models', enabled: true },
            ],
          },
        },
      },
    },
  };
  assert.equal(continuation.autoControlSnapshotKey(base), continuation.autoControlSnapshotKey(afterBillingTick));
});

test('pricing questions and social banter during an active task never pollute the creative brief or bump generationRevision', () => {
  continuation.clearAutoControlTask();
  const brief = 'Create a 3-scene short about a cosmic lighthouse and stop before publishing';
  continuation.noteAutoControlUserTurn(brief);
  const evidence = {
    operation: { kind: 'click', actionId: 'clikb.creation.workstation_image.action.recreate' },
    status: 'observed_success',
    mutationSent: true,
    executionScope: 'b'.repeat(64),
  };
  continuation.noteAutoControlGateStage('observed_success', { evidence });
  assert.equal(continuation.getAutoControlTask().generationRevision, 0);

  continuation.noteAutoControlUserTurn('How much does Terra 6.1 cost?');
  assert.equal(continuation.autoControlRequestContext('').activeGenerationRevision, 0);
  assert.equal(continuation.autoControlRequestContext('').activeAutoControlGoal, brief);
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.equal(continuation.getAutoControlTask().goal, brief);
  assert.equal(continuation.getAutoControlTask().generationRevision, 0);

  continuation.noteAutoControlUserTurn('Haha awesome thanks!');
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.equal(continuation.getAutoControlTask().goal, brief);
  assert.equal(continuation.getAutoControlTask().generationRevision, 0);
});

test('F10: social-opener utterances containing corrections or refinements update the active goal and bump generationRevision', () => {
  continuation.clearAutoControlTask();
  const brief = 'Create a 2-scene Cinema story with character references and stop before publishing';
  continuation.noteAutoControlUserTurn(brief);
  const evidence = {
    operation: { kind: 'click', actionId: 'clikb.creation.workstation_image.action.recreate' },
    status: 'observed_success',
    mutationSent: true,
    executionScope: 'c'.repeat(64),
  };
  continuation.noteAutoControlGateStage('observed_success', { evidence });
  assert.equal(continuation.getAutoControlTask().generationRevision, 0);

  // "Nice, but no character references" starts with a social opener ("Nice,") followed by a contrast/negation refinement
  continuation.noteAutoControlUserTurn('Nice, but no character references');
  assert.equal(continuation.autoControlRequestContext('').activeGenerationRevision, 1);
  assert.ok(continuation.autoControlRequestContext('').activeAutoControlGoal.includes('Nice, but no character references'));
  continuation.noteAutoControlGateStage('app_action_requested');
  assert.ok(continuation.getAutoControlTask().goal.endsWith('Nice, but no character references'));
  assert.equal(continuation.getAutoControlTask().generationRevision, 1);
});

test('F11: timed slideshow / periodic tasks preserve waitStartedAt across early checks and wake on the requested interval', () => {
  const RealDateNow = Date.now;
  try {
    Date.now = () => 1000;
    continuation.clearAutoControlTask();
    continuation.noteAutoControlUserTurn('Create a slideshow and scroll down every 15 seconds');
    continuation.noteAutoControlGateStage('handler_dispatched');
    const task0 = continuation.getAutoControlTask();
    assert.equal(continuation.requestedAutoControlIntervalMs(task0.goal), 15000);
    continuation.noteAutoControlGateStage('task_waiting', undefined, 'feed-item-1');
    continuation.idleAutoControlTask();
    assert.equal(continuation.getAutoControlTask().waitStartedAt, 1000);

    // Early check at t = 6000 (only 5s elapsed < 15s interval) with unchanged snapshotKey:
    // must NOT reset waitStartedAt to 6000, and shouldWakeAutoControlHeartbeat must wait until t >= 16000
    Date.now = () => 6000;
    const earlyCheck = continuation.shouldWakeAutoControlHeartbeat({
      task: continuation.getAutoControlTask(),
      now: 6000,
      running: false,
      quietUntil: 0,
      lastPingAt: 1000,
      lastRunRevision: continuation.getAutoControlTask().revision,
      currentSnapshotKey: 'feed-item-1',
      lastSnapshotKey: 'feed-item-1',
      unchangedChecks: 1,
      maxUnchangedChecks: 1,
    });
    assert.equal(earlyCheck.isTimedTask, true);
    assert.equal(earlyCheck.effectiveIntervalMs, 15000);
    assert.equal(earlyCheck.shouldWake, false);
    continuation.noteAutoControlGateStage('task_waiting', undefined, 'feed-item-1');
    continuation.idleAutoControlTask();
    assert.equal(continuation.getAutoControlTask().waitStartedAt, 1000);

    // At t = 16000 (15s after waitStartedAt = 1000), timed slideshow wakes even though unchangedChecks === 1 and snapshotKey is unchanged
    Date.now = () => 16000;
    const dueCheck = continuation.shouldWakeAutoControlHeartbeat({
      task: continuation.getAutoControlTask(),
      now: 16000,
      running: false,
      quietUntil: 0,
      lastPingAt: 6000,
      lastRunRevision: continuation.getAutoControlTask().revision,
      currentSnapshotKey: 'feed-item-1',
      lastSnapshotKey: 'feed-item-1',
      unchangedChecks: 1,
      maxUnchangedChecks: 1,
    });
    assert.equal(dueCheck.shouldWake, true);
  } finally {
    Date.now = RealDateNow;
  }
});

test('timer parsing requires a temporal instruction and understands spoken and numeric intervals', () => {
  for (const text of [
    'Create three cover images with a title on every image and stop at Publish',
    'Give every character a red hat, then automatically continue to Publish',
    'Create an image for each scene',
    'Scroll to the next image',
  ]) assert.equal(continuation.requestedAutoControlIntervalMs(text, true), null, text);
  for (const [text, expected] of [
    ['Run a fullscreen slideshow, advance every eight seconds', 8000],
    ['Run a fullscreen slideshow, advance every two hours', 7200000],
    ['Advance every one day', 86400000],
    ['Scroll down every 15 seconds', 15000],
    ['Advance at thirty-second intervals', 30000],
    ['Check every one minute', 60000],
    ['Check every two and a half minutes', 150000],
    ['Check every ten minutes', 600000],
    ['Advance every 2.5 seconds', 2500],
    ['Wait for eight seconds then close the scene', 8000],
    ['Advance every eight seconds\nUser refinement: advance every fifteen seconds', 15000],
  ]) assert.equal(continuation.requestedAutoControlIntervalMs(text), expected, text);
  assert.equal(continuation.requestedAutoControlIntervalMs('Keep advancing the fullscreen slideshow', true), 4000);
  assert.equal(continuation.requestedAutoControlIntervalMs('Go to the next post', true), null);
});

// Execute the component's actual interval callback; a helper-only test would miss
// wiring that accidentally keeps a non-timed task active after the first check.
function heartbeatHarness(goal) {
  const providerPath = path.resolve(__dirname, '../src/components/BrainstormSessionProvider.tsx');
  const provider = ts.createSourceFile(providerPath, fs.readFileSync(providerPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'setInterval'
        && node.arguments[0]?.getText(provider).includes('shouldWakeAutoControlHeartbeat')) callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(provider);
  assert.ok(callback, 'Production heartbeat callback must exist');
  const expression = ts.transpileModule(`(${callback.getText(provider)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText.trim().replace(/;$/, '');
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  continuation.clearAutoControlTask();
  continuation.noteAutoControlUserTurn(goal);
  continuation.noteAutoControlGateStage('handler_dispatched');
  const calls = [];
  const snapshot = { creation: { isGenerating: true }, feeds: { activeAreaIds: [] } };
  const scope = {
    ...continuation,
    Date, AbortController,
    eligible: () => true, document: { hidden: false },
    snapshotKey: () => 'unchanged', progressKey: () => 'generating',
    lastProgressKey: 'generating', lastSnapshotKey: 'unchanged', unchangedChecks: 0,
    lastRunRevision: -1, lastPingAt: 0, running: false,
    voiceBusyRef: { current: false }, automaticGuideInFlightRef: { current: new Set() },
    store: { getState: () => ({ brainstorm: { userSnapshot: snapshot, automaticGuide: { calls: {} } } }) },
    getExecutingNavigationAction: () => null, getExecutingNavigationScroll: () => null,
    chatHistoryRef: { current: [] }, heartbeatQuietUntilRef: { current: 0 }, heartbeatAbortRef: { current: null },
    fullAppVoiceAsk: async () => {
      calls.push(now);
      continuation.noteAutoControlGateStage('task_waiting');
      return '[NO_UPDATE]';
    },
    queueAutomaticAnnouncement: () => {},
  };
  const tick = new Function('scope', `with (scope) { return ${expression}; }`)(scope);
  return {
    calls, scope,
    async tick(at) { now = at; tick(); await new Promise(resolve => setImmediate(resolve)); },
    close() { continuation.clearAutoControlTask(); Date.now = originalNow; },
  };
}

test('production heartbeat does not poll unchanged generation for every-image instructions, and still wakes on state change', async () => {
  const timer = heartbeatHarness('Create three cover images with a title on every image and stop at Publish');
  try {
    for (const now of [3000, 5000, 7000, 9000, 11000]) await timer.tick(now);
    assert.deepEqual(timer.calls, [3000]);
    timer.scope.snapshotKey = () => 'images-ready';
    await timer.tick(13000);
    await timer.tick(15000);
    assert.deepEqual(timer.calls, [3000, 13000]);
  } finally { timer.close(); }
});

test('production heartbeat wakes at eight-second and numeric fifteen-second intervals without an early polling loop', async () => {
  for (const [goal, ticks, expected] of [
    ['Run a fullscreen slideshow and advance every eight seconds', [3000, 5000, 8000, 9000, 11000, 17000], [9000, 17000]],
    ['Scroll down every 15 seconds', [3000, 6000, 15000, 16000, 18000, 31000], [16000, 31000]],
  ]) {
    const timer = heartbeatHarness(goal);
    try {
      for (const now of ticks) await timer.tick(now);
      assert.deepEqual(timer.calls, expected, goal);
    } finally { timer.close(); }
  }
});

test('continuation module passes TypeScript semantic checking, not only transpilation', () => {
  const program = ts.createProgram([filename], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    noEmit: true, types: [], skipLibCheck: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});
