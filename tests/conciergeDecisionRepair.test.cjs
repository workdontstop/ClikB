const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');
const { ConciergeSnapshotBroker } = load('server/src/ConciergeSnapshotBroker.ts');
const { ConciergeDecisionContext } = load('server/src/ConciergeDecisionContext.ts');
const { runConciergeControlLoop } = load('server/src/ConciergeControlLoop.ts');
const { interruptedConciergeFeedback } = load('src/conciergeAnnouncements.ts');
let seq = 0;
const area = 'clikb.creation.notepad';
const close = `${area}.action.close`, wrong = `${area}.action.scenes`;
const state = () => ({ route: '/images', autoControl: { enabled: true, videoEnabled: false }, creation: {
  projectId: 'p', mode: 'shorts', stage: 'editor', controls: { stateVersion: 1, areas: { [area]: {
    state: {}, controls: [close, wrong].map(actionId => ({ actionId, controlId: actionId.replace('.action.', '.control.'),
      kind: 'click', policy: 'candidate', enabled: true, ownerId: 'modal-owner', label: actionId === close ? 'Save and close Notepad' : 'Scenes' })) } } } } });
const call = (name, args) => ({ id: `c${++seq}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const propose = id => call('virtualGate', { kind: 'click', actionId: id, scrollId: null, direction: null, textValue: null, rationale: 'Close the requested editor' });
function setup(s, responses) {
  const input = [], spoken = [], stages = [], gates = [], executed = [];
  const deps = { snapshotBroker: new ConciergeSnapshotBroker(`repair-${++seq}`, s),
    complete: async (messages, tools) => { input.push({ messages, tools }); return responses.shift() || { text: 'The requested change is recorded.', calls: [] }; },
    observe: async () => ({ status: 'observed', snapshot: s }),
    intent: async (_, raw) => { assert.equal(raw, s); gates.push('intent'); return { status: 'ok', intent: 'app_action_requested' }; },
    select: async proposal => { gates.push('selection'); const id = JSON.parse(proposal).suggestedActionId; return { status: 'selected', choice: id,
      operation: { kind: 'click', actionId: id, controlId: id.replace('.action.', '.control.') }, reason: 'chosen' }; },
    approve: async () => { gates.push('approval'); return { status: 'approved', reason: 'approved' }; },
    execute: async approval => { executed.push(approval.operation.actionId); return { status: 'dispatched', mutationSent: true, snapshot: s }; },
    feedsContext: () => '', snapshotText: () => { throw Error('Raw snapshot must stay local'); },
    stage: (name, detail) => stages.push({ name, detail }), respond: (text, force) => spoken.push({ text, force }), cancelled: () => false };
  return { deps, input, spoken, stages, gates, executed,
    run: overrides => runConciergeControlLoop({ messages: [{ role: 'user', content: 'Close Notepad' }], snapshot: s,
      userGoal: 'Close Notepad', heartbeat: false, observationOnly: false, ...overrides }, deps) };
}

test('first decision can act directly; successful progress avoids extra recovery; one turn acknowledgement is forced into stream', async () => {
  const s = state(), h = setup(s, [{ text: '', calls: [propose(close)] }]);
  h.deps.recover = async () => { throw Error('Ordinary successful progress does not require Jev recovery'); };
  await h.run();
  assert.equal(h.input.length, 2);
  assert.deepEqual(h.gates, ['intent', 'selection', 'approval']);
  assert.deepEqual(h.executed, [close]);
  assert.ok(h.spoken[0].force); assert.match(h.spoken[0].text, /working through your request/i);
  assert.equal(h.input[1].messages.some(m => m.role === 'tool' || m.tool_calls), false, 'new sequence has no old tool/reasoning chain');
  assert.match(JSON.stringify(h.input[1].messages), /previousOperationOutcome/);
});

test('same-screen Jev approval correction retains exact alternative, then corrected proposal passes every unchanged gate', async () => {
  const s = state(), h = setup(s, [{ text: '', calls: [propose(wrong)] }, { text: '', calls: [propose(close)] }]);
  let reviews = 0;
  h.deps.approve = async () => (++reviews === 1 ? { status: 'declined', choice: close, reason: `Jev selected another option: ${close}` }
    : { status: 'approved', reason: 'approved' });
  await h.run();
  const correction = h.input[1].messages.filter(m => m.role === 'tool').map(m => JSON.parse(m.content)).find(r => r.correction);
  assert.equal(correction.correction.control.actionId, close);
  assert.equal(correction.correction.requiresNewApproval, true);
  assert.deepEqual(h.executed, [close]); assert.equal(reviews, 2);
  assert.equal(h.gates.filter(g => g === 'intent').length, 2);
});

test('identical reads stop after three without suppressing new evidence or dispatching a mutation', async () => {
  const s = state(), responses = Array.from({ length: 16 }, () => ({ text: '', calls: [call('getCurrentSnapshot', {})] }));
  const h = setup(s, responses); await h.run();
  assert.equal(h.input.length, 3); assert.equal(h.executed.length, 0);
  assert.ok(h.stages.some(s => s.name === 'task_waiting'));
  assert.ok(h.spoken.at(-1).force);
});

test('a fresh owned surface supplied on the next decision needs no redundant read, but an old-surface proposal cannot execute', async () => {
  const s = state(), h = setup(s, [{ text: '', calls: [propose(close)] }]);
  h.deps.observe = async () => ({ status: 'observed', snapshot: { ...s, conciergeFocus: { kind: 'modal', scopeId: 'unmapped', areaIds: [], controlIds: [] } } });
  await h.run(); assert.equal(h.executed.length, 0); assert.equal(h.gates.length, 0);
  assert.ok(h.stages.some(s => s.detail?.status === 'foreground_changed'));
});

test('fresh context keeps full current-source records, task text, and uncertain receipts while retiring another owner and provider exchanges', () => {
  const s = state(), base = [{ role: 'user', content: 'Exact task, stop before Publish' }];
  const c = new ConciergeDecisionContext(base);
  const exact = 'FULL_EXACT_PROMPT_'.repeat(3000);
  c.remember({ source: 'creation', referenceData: true, reference: 'r1', query: 'full prompt', matches: [{ id: 'p', text: exact }] }, s);
  c.remember({ source: 'instructions', referenceData: true, reference: 'r2', query: 'workflow', matches: [{ id: 'w', text: 'EXACT_WORKFLOW' }] }, s);
  const next = c.restart(s, { status: 'execution_unknown', mutationSent: true, snapshot: s });
  assert.equal(next.messages[0].content, base[0].content);
  assert.match(next.messages[1].content, /execution_unknown/);
  assert.equal(JSON.parse(next.messages[1].content).knowledge[0].matches[0].text, exact);
  const other = structuredClone(s); other.creation.projectId = 'other';
  assert.doesNotMatch(JSON.stringify(c.restart(other, { status: 'dispatched' }).messages), /FULL_EXACT_PROMPT|EXACT_WORKFLOW/);
});

test('normal chat and Auto Control Off do not automatically receive a catalogue', async () => {
  for (const change of [{ conversationalTurn: true }, { observationOnly: true }, { off: true }]) {
    const s = state(); if (change.off) s.autoControl.enabled = false;
    const h = setup(s, []); await h.run(change);
    const notice = h.input[0].messages.find(m => m.clikbContext === 'snapshot');
    assert.equal(JSON.parse(notice.content.slice(notice.content.indexOf('\n') + 1)).areas, undefined);
  }
});

test('background stream interruption preserves an accepted action even with no model prose, without claiming completion or inviting replay', () => {
  const text = interruptedConciergeFeedback('', 'Generate Image', true);
  assert.match(text, /requested generate image/);
  assert.match(text, /outcome still needs checking before any retry/);
  assert.doesNotMatch(text, /image is ready|completed|please try again/);
  assert.match(interruptedConciergeFeedback('Existing factual feedback.', null, true), /^Existing factual feedback\./);
  assert.equal(interruptedConciergeFeedback('', null, true), null);
  assert.ok(interruptedConciergeFeedback('', null, false));
});

test('single-step UI transition emits task_completed even while background creation generation is running', async () => {
  const deckArea = 'clikb.feeds.deck';
  const shortsAction = `${deckArea}.action.shorts`;
  const s = {
    route: '/images',
    ui: { minimisePrompt: true },
    autoControl: { enabled: true, videoEnabled: false },
    feeds: {
      stateVersion: 1,
      activeAreaIds: [deckArea],
      availableActions: [{ actionId: shortsAction, controlId: `${deckArea}.control.shorts` }],
      areas: {
        [deckArea]: {
          state: { activeCategory: 'Cinema' },
          visibleControls: [{ controlId: `${deckArea}.control.shorts`, candidateActionId: shortsAction, kind: 'click', aiPolicy: 'candidate', enabled: true, label: 'Shorts' }],
        },
      },
    },
    creation: {
      isActive: true,
      projectId: 'bg-pirates',
      stage: 'storybook',
      isGenerating: true,
      hdImageCount: 1,
      previewSceneCount: 4,
      controls: { stateVersion: 1, areas: {} },
    },
  };
  const after = structuredClone(s);
  after.feeds.areas[deckArea].state.activeCategory = 'Shorts';

  const h = setup(s, [{ text: '', calls: [propose(shortsAction)] }, { text: 'Switched to Shorts while your pirate scenes keep rendering.', calls: [] }]);
  let currentSnap = s;
  h.deps.observe = async () => ({ status: 'observed', snapshot: currentSnap });
  h.deps.execute = async (approval) => {
    h.executed.push(approval.operation.actionId);
    currentSnap = after;
    return { status: 'observed_change', mutationSent: true, snapshot: after };
  };

  await h.run({
    messages: [{ role: 'user', content: 'Switch to Shorts' }],
    userGoal: 'Switch to Shorts',
  });

  assert.deepEqual(h.executed, [shortsAction]);
  assert.ok(
    h.stages.some((st) => st.name === 'task_completed'),
    'Settled single-step Deck switch must complete its UI task even while background generation continues',
  );
});

test('slot-tied retry scope requires matching confirmedFailuresByTarget and never replays unresolved execution_unknown receipts', () => {
  const { conciergeExecutionScope, matchingConfirmedSlotFailure } = load('server/src/ConciergeRecovery.ts');
  const op = { kind: 'click', actionId: 'clikb.creation.workstation_image.action.recreate' };
  const base = {
    creation: {
      projectId: 'proj-retry',
      editStoryIsOpen: true,
      editStoryTargetKey: 'A:1',
      imageError: 'Stale global error from another scene',
      confirmedFailuresByTarget: {},
      controls: {
        areas: {
          'clikb.creation.workstation_image': {
            state: {},
            controls: [{ actionId: op.actionId, label: 'Recreate Image', enabled: true, policy: 'candidate' }],
          },
        },
      },
    },
  };

  // 1. Stale global imageError alone does NOT match or change execution scope
  assert.equal(matchingConfirmedSlotFailure(op, base), undefined);
  const scopeNormal = conciergeExecutionScope(op, base, 0);
  const scopeStaleRetry = conciergeExecutionScope(op, base, 0, { allowConfirmedFailureRetry: true });
  assert.equal(scopeStaleRetry, scopeNormal);

  // 2. Confirmed failure on ANOTHER slot (A:3) does NOT unlock retry on A:1
  const wrongSlot = structuredClone(base);
  wrongSlot.creation.confirmedFailuresByTarget = {
    'proj-retry:image:A:3': {
      attemptId: 'att-other',
      failureId: 'fail:att-other',
      projectId: 'proj-retry',
      mediaKind: 'image',
      targetKey: 'A:3',
      message: 'Scene 4 failed',
    },
  };
  assert.equal(matchingConfirmedSlotFailure(op, wrongSlot), undefined);
  assert.equal(conciergeExecutionScope(op, wrongSlot, 0, { allowConfirmedFailureRetry: true }), scopeNormal);

  // 3. Confirmed failure owned by A:1 unlocks explicit retry scope
  const matchingSlot = structuredClone(base);
  matchingSlot.creation.confirmedFailuresByTarget = {
    'proj-retry:image:A:1': {
      attemptId: 'att-a1',
      failureId: 'fail:att-a1',
      projectId: 'proj-retry',
      mediaKind: 'image',
      targetKey: 'A:1',
      message: 'Scene 2 failed',
    },
  };
  assert.equal(matchingConfirmedSlotFailure(op, matchingSlot)?.failureId, 'fail:att-a1');
  const scopeConfirmedRetry = conciergeExecutionScope(op, matchingSlot, 0, { allowConfirmedFailureRetry: true });
  assert.notEqual(scopeConfirmedRetry, scopeNormal);
});
