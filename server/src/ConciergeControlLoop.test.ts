import assert from 'node:assert/strict';
import test from 'node:test';
import { runConciergeControlLoop, type ConciergeLoopDependencies } from './ConciergeControlLoop';
import { executeApprovedConciergeOperation } from './ConciergeBrowserOperation';
import { CONCIERGE_TOOLS, querySnapshotFields, virtualGateOperation, accumulateToolCalls, type ConciergeToolCall } from './ConciergeTools';
import { ConciergeResponseSession } from './ConciergeInference';
import { resolveConversationProfile } from './conversationModels';
import { decodeReplicateToolReply, replicateToolPrompt, streamReplicateToolReply } from './ReplicateToolAdapter';
import { conciergeExecutionScope } from './ConciergeRecovery';

const args = { kind: 'scroll', actionId: null, scrollId: 'clikb.creation.models.action.scroll', direction: 'forward', textValue: null, rationale: 'Find Nano Banana Pro' };
const call = (value: any = args, name = 'virtualGate') => ({ id: 'call_1', type: 'function' as const, function: { name, arguments: JSON.stringify(value) } });
const snapshot = { autoControl: { enabled: true, conciergeEnabled: true }, navigation: { stateVersion: 2 }, creation: { controls: { stateVersion: 4,
  areas: { models: { controls: [{ actionId: args.scrollId, controlId: 'clikb.creation.models.control.scroll', kind: 'scroll', enabled: true, policy: 'candidate', canScrollForward: true, canScrollBackward: false }] } },
} } };
const input = { messages: [{ role: 'user', content: 'Select Nano Banana Pro' }], userGoal: 'Select Nano Banana Pro', snapshot, heartbeat: false, observationOnly: false };
function harness(responses: Array<{ text: string; calls: ReturnType<typeof call>[] }>) {
  const events: string[] = [];
  const transcripts: any[][] = [];
  const offered: string[][] = [];
  let executions = 0;
  const deps: ConciergeLoopDependencies = {
    complete: async (messages, tools) => { transcripts.push([...messages]); offered.push(tools.map(tool => tool.function.name)); return responses.shift() || { text: 'Done', calls: [] }; },
    observe: async () => ({ status: 'observed', snapshot }),
    intent: async () => { events.push('intent'); return { status: 'ok', intent: 'app_action_requested' }; },
    select: async proposal => { events.push('selection'); const value = JSON.parse(proposal); assert.equal(value.suggestedActionId, 'scroll:clikb.creation.models.action.scroll:forward'); return { status: 'selected', choice: value.suggestedActionId, operation: virtualGateOperation(args), reason: 'chosen' }; },
    approve: async () => { events.push('approval'); return { status: 'approved', reason: 'approved' }; },
    execute: async approval => { executions++; events.push('execution'); assert.equal(approval.stateVersion, 4); return { status: 'settled', snapshot, mutationSent: true }; },
    feedsContext: () => '', snapshotText: value => JSON.stringify(value), stage: name => events.push(name), cancelled: () => false,
  };
  return { deps, events, transcripts, offered, executions: () => executions };
}

test('a retained stop at Publish rejects premature completion and publishing through the tool loop', async () => {
  const h = harness([
    { text: '', calls: [call({ status: 'completed', detail: 'Both images are ready' }, 'finishAutoControlTask')] },
    { text: '', calls: [call({ ...args, kind: 'click', actionId: 'clikb.creation.storybook_grid.action.publish', scrollId: null, direction: null })] },
    { text: 'The Publish destination still needs to be reached.', calls: [] },
  ]);
  await runConciergeControlLoop({ ...input, userGoal: 'Create two images and stop at Publish\nUser refinement: continue' }, h.deps);
  assert.equal(h.executions(), 0);
  assert.ok(!h.events.includes('task_completed'));
  assert.ok(h.events.includes('action_blocked'));
  const results = h.transcripts.flatMap(messages => messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content)));
  assert.ok(results.some(result => result.status === 'completion_unverified'));
  assert.ok(!h.events.includes('intent'), 'Publication boundary is enforced before proposing a gated action');
});

test('reaching the live music Publish destination can complete without clicking it', async () => {
  const h = harness([{ text: '', calls: [call({ status: 'completed', detail: 'Ready at the music Publish review' }, 'finishAutoControlTask')] }]);
  const live = { ...snapshot, creation: { controls: { areas: { selector: { controls: [{
    actionId: 'clikb.creation.storybook_studio_selector.action.publish_music_video', enabled: true,
  }] } } } } };
  h.deps.observe = async () => ({ status: 'observed', snapshot: live });
  h.deps.recover = async () => ({ status: 'ok', choice: 'completed', reason: 'Requested music shots are ready at Publish' });
  await runConciergeControlLoop({ ...input, snapshot: live, userGoal: 'Create a music video and stop at Publish' }, h.deps);
  assert.equal(h.executions(), 0);
  assert.ok(h.events.includes('task_completed'));
});

test('speech containing a VirtualGate ID never calls Jev or the browser', async () => {
  const h = harness([{ text: 'VirtualGate clikb.creation.models.action.scroll', calls: [] }]);
  await runConciergeControlLoop(input, h.deps);
  assert.equal(h.executions(), 0);
  assert.deepEqual(h.events, []);
});

test('each reasoning concierge profile uses the unchanged Jev intent, selection, approval and browser loop', async () => {
  for (const tier of ['luna', 'luna_xhigh', 'sol']) {
    const h = harness([]), session = new ConciergeResponseSession();
    const outputCall = { type: 'function_call', id: 'fc_test', call_id: 'call_profile', name: 'virtualGate', arguments: JSON.stringify(args) };
    const outputs = [[{ type: 'reasoning', id: 'rs_test', encrypted_content: 'opaque', summary: [] }, outputCall], []];
    const requests: any[] = [];
    const client: any = { responses: { create: async (request: any) => {
      requests.push(request); const output = outputs.shift()!;
      return (async function* () {
        yield { type: 'response.completed', response: { status: 'completed', output } };
      })();
    } } };
    h.deps.complete = async (messages, tools) => {
      const calls = new Map<number, ConciergeToolCall>();
      for await (const chunk of session.stream(client, { profile: resolveConversationProfile(tier)!, messages, tools })) {
        accumulateToolCalls(calls, chunk.choices?.[0]?.delta?.tool_calls || []);
      }
      return { text: '', calls: [...calls.values()] };
    };
    await runConciergeControlLoop(input, h.deps);
    assert.equal(h.executions(), 1);
    assert.deepEqual(h.events.filter(event => ['intent', 'selection', 'approval', 'execution'].includes(event)), ['intent', 'selection', 'approval', 'execution']);
    assert.ok(requests[1].input.some((item: any) => item.type === 'function_call_output' && item.call_id === 'call_profile'));
    assert.ok(requests[1].input.some((item: any) => item.type === 'reasoning' && item.encrypted_content === 'opaque'));
  }
});

test('a premature no-call refusal asks Jev once and a corrected operation still passes every normal gate', async () => {
  const h = harness([{ text: 'I cannot do anything', calls: [] }, { text: 'I will scroll', calls: [call()] },
    { text: '', calls: [call({ status: 'waiting', detail: 'Picker contents are updating' }, 'finishAutoControlTask')] },
    { text: 'The picker is updating.', calls: [] }]);
  const delivered: string[] = [];
  let assessments = 0;
  h.deps.respond = text => delivered.push(text);
  h.deps.recover = async evidence => {
    assessments++;
    assert.equal(evidence.userGoal, input.userGoal);
    assert.equal(evidence.assistantAssessment, 'I cannot do anything');
    assert.deepEqual(evidence.snapshot, snapshot);
    return { status: 'ok', choice: 'continue', reason: 'Live scroll is available' };
  };
  await runConciergeControlLoop(input, h.deps);
  assert.equal(assessments, 1);
  assert.equal(h.executions(), 1);
  assert.deepEqual(h.events.filter(event => ['intent', 'selection', 'approval', 'execution'].includes(event)), ['intent', 'selection', 'approval', 'execution']);
  assert.deepEqual(delivered, ['I will scroll'], 'Do not append a stock recap after useful progress was already delivered');
});

test('Off, observation-only, and ordinary conversation make no additional recovery request', async () => {
  for (const changes of [{ snapshot: { ...snapshot, autoControl: { enabled: false } } },
    { observationOnly: true }, { userGoal: 'How is your day?' }]) {
    const h = harness([{ text: 'A conversational answer', calls: [] }]);
    let reads = 0;
    h.deps.observe = async () => { reads++; return { status: 'observed', snapshot }; };
    h.deps.recover = async () => { assert.fail('No extra Jev request'); };
    await runConciergeControlLoop({ ...input, ...changes }, h.deps);
    assert.equal(reads, 0);
  }
});

test('accepted asynchronous work is observed then retained as waiting without duplicate dispatch or stale narration', async () => {
  const h = harness([{ text: 'I cannot start it', calls: [call()] }, { text: 'Generation did not start', calls: [] },
    { text: 'The request was accepted; work is still running.', calls: [] }]);
  h.deps.execute = async () => { h.events.push('execution'); return { status: 'dispatched', mutationSent: true,
    snapshot: { ...snapshot, creation: { ...snapshot.creation, isGenerating: true } } }; };
  h.deps.observe = async () => ({ status: 'observed', snapshot: { ...snapshot, creation: { ...snapshot.creation, isGenerating: true } } });
  let checks = 0;
  h.deps.recover = async evidence => {
    checks++;
    assert.equal(evidence.snapshot.creation.isGenerating, true);
    assert.equal(evidence.recentResults[0].status, 'dispatched');
    return { status: 'ok', choice: 'wait', reason: 'Generation is running' };
  };
  const delivered: string[] = []; h.deps.respond = text => delivered.push(text);
  await runConciergeControlLoop(input, h.deps);
  assert.equal(checks, 1);
  assert.equal(h.events.filter(event => event === 'execution').length, 1);
  assert.ok(h.events.includes('task_waiting'));
  assert.ok(!h.events.includes('task_completed'));
  assert.ok(delivered[0].includes('working through')); assert.equal(delivered.at(-1), 'The request was accepted; work is still running.');
});

test('an asserted completion cannot clear a task while Jev observes unfinished work', async () => {
  const h = harness([{ text: '', calls: [call({ status: 'completed', detail: 'I am done' }, 'finishAutoControlTask')] },
    { text: 'Work remains in progress.', calls: [] }]);
  h.deps.recover = async evidence => {
    assert.equal(evidence.requestedCompletion, true);
    return { status: 'ok', choice: 'wait', reason: 'Observed stage is intermediate' };
  };
  await runConciergeControlLoop(input, h.deps);
  assert.ok(h.events.includes('task_waiting'));
  assert.ok(!h.events.includes('task_completed'));
});

test('persistent premature refusal has a bounded recovery budget and retains the task', async () => {
  const h = harness(Array.from({ length: 8 }, () => ({ text: 'I cannot continue', calls: [] })));
  let assessments = 0;
  h.deps.recover = async () => { assessments++; return { status: 'ok', choice: 'continue', reason: 'Try the available live control' }; };
  await runConciergeControlLoop(input, h.deps);
  assert.equal(assessments, 2);
  assert.equal(h.executions(), 0);
  assert.ok(h.events.includes('task_waiting'));
});

test('structured scroll follows intent, exact selection, approval and browser feedback', async () => {
  const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call({ status: 'completed', detail: 'Requested end state observed' }, 'finishAutoControlTask')] }]);
  await runConciergeControlLoop(input, h.deps);
  assert.equal(h.executions(), 1);
  assert.deepEqual(h.events.filter(event => ['intent', 'selection', 'approval', 'execution'].includes(event)), ['intent', 'selection', 'approval', 'execution']);
  assert.ok(h.events.includes('task_completed'));
  assert.deepEqual(h.offered[2], []);
  const result = JSON.parse(h.transcripts[1].find(message => message.role === 'tool').content);
  assert.equal(result.status, 'settled');
  assert.ok(h.transcripts[1].some(message => message.tool_calls?.[0].id === 'call_1'));
});

test('invalid scroll arguments get bounded correction without Jev or dispatch', async () => {
  const bad = { ...args, direction: null };
  const h = harness([{ text: '', calls: [call(bad)] }, { text: '', calls: [call()] }]);
  await runConciergeControlLoop(input, h.deps);
  assert.equal(h.executions(), 1);
  assert.ok(h.events.includes('recoverable_failure'));
  assert.equal(JSON.parse(h.transcripts[1].find(message => message.role === 'tool').content).mutationSent, false);
  const repeated = harness([{ text: '', calls: [call(bad)] }, { text: '', calls: [call(bad)] }, { text: '', calls: [call(bad)] }, { text: '', calls: [call()] }]);
  await runConciergeControlLoop(input, repeated.deps);
  assert.equal(repeated.executions(), 0);
  assert.ok(repeated.events.includes('action_blocked'));
});

test('parallel proposals and stale live IDs receive one correction before any Jev call', async () => {
  for (const calls of [[call(), { ...call(), id: 'call_2' }], [call({ ...args, scrollId: 'clikb.creation.models.action.missing' })]]) {
    const h = harness([{ text: '', calls }, { text: '', calls: [call()] }]);
    await runConciergeControlLoop(input, h.deps);
    assert.equal(h.executions(), 1);
    assert.equal(h.events.filter(event => event === 'intent').length, 1);
    assert.ok(h.events.includes('recoverable_failure'));
    assert.equal(h.transcripts[1].filter(message => message.role === 'tool').length, calls.length);
  }
});

test('temporary Jev output failure is correctable; missing RAG and account failures pause', async () => {
  for (const reason of ['missing or invalid typed choice', 'The active clikb_creation RAG is not uploaded/retrieved', 'HTTP 401', 'HTTP 429']) {
    const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call()] }]);
    let approvals = 0;
    h.deps.approve = async () => ++approvals === 1 ? { status: 'unavailable', reason } : { status: 'approved', reason: 'corrected' };
    await runConciergeControlLoop(input, h.deps);
    const repairable = reason === 'missing or invalid typed choice';
    assert.equal(h.executions(), repairable ? 1 : 0);
    if (repairable) {
      assert.ok(h.offered[1].includes('virtualGate'));
      const result = JSON.parse(h.transcripts[1].find(message => message.role === 'tool').content);
      assert.equal(result.status, 'jev_unavailable');
    } else {
      assert.equal(h.offered.length, 1, 'Permanent failures end without another model call');
      assert.ok(h.events.includes('action_blocked'));
    }
  }
});

test('shared dispatcher handles navigation clicks, Feeds clicks and Creation text with the same gates', async () => {
  for (const proposal of [
    { ...args, kind: 'click', actionId: 'clikb.settings.action.theme_light', scrollId: null, direction: null },
    { ...args, kind: 'click', actionId: 'clikb.feeds.fullscreen.shorts.next', scrollId: null, direction: null },
    { ...args, kind: 'text', actionId: 'clikb.creation.notepad.action.prompt', scrollId: null, direction: null, textValue: 'A new scene' },
  ]) {
    const h = harness([{ text: '', calls: [call(proposal)] }]);
    const operation = virtualGateOperation(proposal);
    assert.notEqual(operation.kind, 'scroll');
    const live = { ...snapshot, navigation: { stateVersion: 2, availableActions: [{ actionId: proposal.actionId }] },
      feeds: { stateVersion: 3, availableActions: [{ actionId: proposal.actionId }] },
      creation: { controls: { stateVersion: 4, areas: { notepad: { controls: [{ ...operation, enabled: true, policy: 'candidate' }] } } } } };
    h.deps.observe = async () => ({ status: 'observed', snapshot: live });
    h.deps.select = async value => { h.events.push('selection'); return { status: 'selected', choice: JSON.parse(value).suggestedActionId, operation, reason: 'exact' }; };
    const executed: Array<Parameters<ConciergeLoopDependencies['execute']>[0]> = [];
    h.deps.execute = async approval => { h.events.push('execution'); executed.push(approval); return { status: 'observed_change', snapshot: live, mutationSent: true }; };
    await runConciergeControlLoop(input, h.deps);
    assert.deepEqual(executed[0]?.operation, operation);
    assert.deepEqual(h.events.filter(event => ['intent', 'selection', 'approval', 'execution'].includes(event)), ['intent', 'selection', 'approval', 'execution']);
  }
});

test('permission Off and user refusal never mutate or retry', async () => {
  for (const mode of ['off', 'decline']) {
    const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call()] }]);
    if (mode === 'off') h.deps.observe = async () => ({ status: 'observed', snapshot: { ...snapshot, autoControl: { enabled: false } } });
    else h.deps.select = async () => ({ status: 'declined', reason: 'The user denied this operation' });
    await runConciergeControlLoop(input, h.deps);
    assert.equal(h.executions(), 0);
    assert.equal(h.offered.length, 1, 'Blocked/uncertain operations end without another model call');
  }
});

test('ordinary selection failure can recover through fresh Jev without bypassing it', async () => {
  const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call()] }]);
  let attempts = 0;
  const select = h.deps.select;
  h.deps.select = async (...args) => ++attempts === 1
    ? { status: 'declined', reason: 'no matching operation' } : select(...args);
  await runConciergeControlLoop(input, h.deps);
  assert.equal(attempts, 2);
  assert.equal(h.executions(), 1);
  assert.ok(h.events.includes('recoverable_failure'));
  assert.equal(h.events.filter(event => event === 'approval').length, 1);
});

test('alternating failure statuses share the three-attempt budget for one unchanged target', async () => {
  const h = harness(Array.from({ length: 4 }, () => ({ text: '', calls: [call()] })));
  let observations = 0;
  h.deps.observe = async () => ++observations === 1
    ? { status: 'unavailable', detail: 'Snapshot temporarily unavailable' }
    : { status: 'observed', snapshot };
  let intents = 0;
  h.deps.intent = async () => ++intents === 1
    ? { status: 'unavailable', reason: 'missing typed intent' }
    : { status: 'ok', intent: 'app_action_requested' };
  h.deps.select = async () => ({ status: 'declined', reason: 'no matching operation' });
  await runConciergeControlLoop(input, h.deps);
  assert.equal(h.executions(), 0);
  assert.equal(observations, 3);
  assert.equal(intents, 2);
  assert.equal(h.offered.length, 3, 'An exhausted retry budget does not buy another model call');
  assert.equal(h.events.filter(event => event === 'recoverable_failure').length, 2);
  assert.ok(h.events.includes('action_blocked'));
});

test('stale state before dispatch is corrected once with fresh approval', async () => {
  const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call()] }]);
  let attempt = 0;
  h.deps.execute = async () => ++attempt === 1 ? { status: 'stale_or_unavailable', mutationSent: false } : { status: 'settled', snapshot, mutationSent: true };
  await runConciergeControlLoop(input, h.deps);
  assert.equal(attempt, 2);
  assert.equal(h.events.filter(event => event === 'approval').length, 2);
});

test('unknown post-dispatch timeout is observed and never replayed', async () => {
  const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call()] }]);
  let dispatched = 0;
  h.deps.execute = async () => { dispatched++; return { status: 'timeout', mutationSent: true }; };
  await runConciergeControlLoop(input, h.deps);
  assert.equal(dispatched, 1);
  assert.equal(h.offered.length, 1, 'Blocked/uncertain operations end without another model call');
  assert.ok(h.events.includes('action_blocked'));
});

test('a later heartbeat cannot replay accepted or uncertain generation after unrelated state changes', async () => {
  const proposal = { ...args, kind: 'click', actionId: 'clikb.creation.workstation_image.action.generate', scrollId: null, direction: null };
  const operation = virtualGateOperation(proposal);
  const live = { ...snapshot, creation: { projectId: 'story-1', editStoryIsOpen: true, editStoryNativeSceneIndex: 2,
    editStoryCurrentImagePrompt: 'A cinematic Earth', controls: {stateVersion:7, areas:{workstation_image:{controls:[
      {...operation,enabled:true,policy:'candidate',label:'Generate Image'}]}}} } };
  const scope = conciergeExecutionScope(operation, live);
  assert.ok(scope);
  for (const status of ['dispatched','timeout','execution_unknown']) {
    const h = harness([{text:'',calls:[call(proposal)]}]);
    h.deps.observe = async () => ({status:'observed',snapshot:live});
    await runConciergeControlLoop({...input,snapshot:live,heartbeat:true,previousActionEvidence:[
      {operation,status,mutationSent:true,executionScope:scope},
    ]},h.deps);
    assert.equal(h.executions(),0,status);
    assert.ok(h.events.includes('recoverable_failure'));
    assert.equal(h.events.includes('intent'),false,'no duplicate proposal reaches dispatch gates');
  }
  assert.equal(conciergeExecutionScope(operation,{...live,creation:{...live.creation,controls:{...live.creation.controls,stateVersion:99}}}),scope);
  assert.notEqual(conciergeExecutionScope(operation,{...live,creation:{...live.creation,editStoryNativeSceneIndex:3}}),scope);
  assert.notEqual(conciergeExecutionScope(operation,{...live,creation:{...live.creation,editStoryCurrentImagePrompt:'A different shot'}}),scope);
  assert.notEqual(conciergeExecutionScope(operation,live,1),scope,'an explicit new user replacement remains possible through normal gates');
  assert.equal(conciergeExecutionScope({kind:'click',actionId:'clikb.creation.storybook_grid.action.open_scene_2'},live),'','scene navigation stays repeatable');
  const nextProposal = {...proposal,actionId:'clikb.creation.storybook_grid.action.open_scene_3'};
  const nextOperation = virtualGateOperation(nextProposal);
  live.creation.controls.areas.workstation_image.controls.push({...nextOperation,enabled:true,policy:'candidate',label:'Open next scene'});
  const h = harness([{text:'',calls:[call(proposal)]},{text:'',calls:[call(nextProposal)]}]);
  h.deps.observe = async () => ({status:'observed',snapshot:live});
  h.deps.select = async value => ({status:'selected',choice:JSON.parse(value).suggestedActionId,operation:nextOperation,reason:'Next unfinished scene'});
  const executed:unknown[]=[];
  h.deps.execute = async approval => {executed.push(approval.operation);return {status:'dispatched',snapshot:live,mutationSent:true};};
  await runConciergeControlLoop({...input,snapshot:live,previousActionEvidence:[{operation,status:'dispatched',mutationSent:true,executionScope:scope}]},h.deps);
  assert.deepEqual(executed,[nextOperation],'blocking duplicate work must still allow another safe next step');
});

test('heartbeat allows at most one mutation; observation-only updates have only read tools', async () => {
  const h = harness([{ text: '', calls: [call()] }, { text: '', calls: [call({ status: 'waiting', detail: 'More work after this check' }, 'finishAutoControlTask')] }]);
  await runConciergeControlLoop({ ...input, heartbeat: true }, h.deps);
  assert.equal(h.executions(), 1);
  assert.equal(h.offered.length, 1, 'An accepted automatic action does not buy a second model call to finish waiting');
  assert.ok(h.events.includes('task_waiting'));
  const automatic = harness([{ text: 'Review done', calls: [] }]);
  await runConciergeControlLoop({ ...input, observationOnly: true }, automatic.deps);
  assert.deepEqual(automatic.offered[0], ['searchAppKnowledge', 'searchSessionMemory', 'searchCreationMemory', 'getCurrentSnapshot', 'queryLiveSnapshot']);
  assert.equal(automatic.executions(), 0);
});

test('user cancellation after approval prevents execution', async () => {
  const h = harness([{ text: '', calls: [call()] }]);
  let cancelled = false;
  h.deps.approve = async () => { cancelled = true; return { status: 'approved', reason: 'approved' }; };
  h.deps.cancelled = () => cancelled;
  h.deps.execute = async () => { assert.ok(cancelled); return { status: 'stopped', mutationSent: false }; };
  await runConciergeControlLoop(input, h.deps);
  assert.equal(h.executions(), 0);
});

test('fresh execution rechecks version and exact paid confirmation before command dispatch', async () => {
  const operation = { kind: 'click' as const, actionId: 'clikb.creation.workstation.action.generate_video', controlId: 'clikb.creation.workstation.control.generate_video' };
  const live = { ...snapshot, creation: { controls: { stateVersion: 4, areas: { workstation: { controls: [{ ...operation, enabled: true, policy: 'needs_confirmation', label: 'Generate video' }] } } } } };
  let commands = 0;
  const base = { operation, stateVersion: 4, feedsContext: '', latestRealUserText: 'yes', observe: async () => ({ status: 'observed', snapshot: live }),
    cancelled: () => false, dispatch: async () => { commands++; return { status: 'dispatched' }; } };
  assert.equal((await executeApprovedConciergeOperation(base)).status, 'confirmation_required');
  assert.equal(commands, 0);
  assert.equal((await executeApprovedConciergeOperation({ ...base, confirmedControlId: operation.controlId, stateVersion: 3 })).status, 'stale_or_unavailable');
  assert.equal(commands, 0);
  assert.equal((await executeApprovedConciergeOperation({ ...base, confirmedControlId: operation.controlId })).status, 'dispatched');
  assert.equal(commands, 1);
});

test('scoped reads include Auto Control and explicit unknowns while rejecting unsafe pointers', () => {
  assert.deepEqual(querySnapshotFields(snapshot, ['/autoControl/enabled', '/creation/missing']), [
    { pointer: '/autoControl/enabled', status: 'found', value: true }, { pointer: '/creation/missing', status: 'unknown' },
  ]);
  assert.throws(() => querySnapshotFields(snapshot, ['/secrets/key']));
  assert.equal(querySnapshotFields(snapshot, ['/creation/__proto__'])[0].status, 'unknown');
});

test('ordinary non-paid click failure triggers Concierge-briefed Jev recovery and continues without getting stuck', async () => {
  const firstClick = { kind: 'click', actionId: 'clikb.creation.storybook_grid.action.open_scene_1', scrollId: null, direction: null, textValue: null, rationale: 'Open Scene 1 in workstation' };
  const secondClick = { kind: 'click', actionId: 'clikb.creation.storybook_grid.action.edit_scene_1', scrollId: null, direction: null, textValue: null, rationale: 'Use pencil button to open Scene 1' };
  const op1 = virtualGateOperation(firstClick);
  const op2 = virtualGateOperation(secondClick);
  const live = { ...snapshot, creation: { controls: { stateVersion: 4, areas: { storybook_grid: { controls: [
    { ...op1, controlId: 'clikb.creation.storybook_grid.control.open_scene_1', enabled: true, policy: 'candidate', label: 'Open Scene 1' },
    { ...op2, controlId: 'clikb.creation.storybook_grid.control.edit_scene_1', enabled: true, policy: 'candidate', label: 'Edit Scene 1' },
  ] } } } } };
  const h = harness([
    { text: '', calls: [call(firstClick)] },
    { text: 'Trying to open Scene 1 in the workstation; edit_scene_1 is available as an alternative.', calls: [] },
    { text: '', calls: [call(secondClick)] },
    { text: 'Opened Scene 1.', calls: [] },
  ]);
  h.deps.observe = async () => ({ status: 'observed', snapshot: live });
  h.deps.select = async value => {
    const suggested = JSON.parse(value).suggestedActionId;
    return { status: 'selected', choice: suggested, operation: suggested === firstClick.actionId ? op1 : op2, reason: 'selected' };
  };
  let attempts = 0;
  h.deps.execute = async () => ++attempts === 1
    ? { status: 'rejected', detail: 'Target temporarily covered', mutationSent: false, snapshot: live }
    : { status: 'dispatched', detail: 'Opened Scene 1', mutationSent: true, snapshot: live };
  let recoveryBrief = '';
  h.deps.recover = async evidence => {
    if (!recoveryBrief) recoveryBrief = evidence.assistantAssessment;
    assert.equal(evidence.uncertainExecution, false);
    return { status: 'ok', choice: 'continue', reason: 'Try edit_scene_1 to open Scene 1' };
  };
  await runConciergeControlLoop({ ...input, userGoal: 'Open Scene 1 and edit its prompt', snapshot: live }, h.deps);
  assert.equal(attempts, 2);
  assert.match(recoveryBrief, /edit_scene_1/);
  assert.ok(h.events.includes('recovery_assessed'));
  assert.ok(h.events.includes('handler_dispatched'));
});

test('heartbeat during active creation work preserves [NO_UPDATE] and companion replies without extra Jev recovery calls', async () => {
  const generatingSnapshot = { ...snapshot, creation: { ...snapshot.creation, isGenerating: true } };
  for (const replyText of ['[NO_UPDATE]', 'Still generating your scene, hang tight!']) {
    const h = harness([{ text: replyText, calls: [] }]);
    const delivered: string[] = [];
    h.deps.respond = text => delivered.push(text);
    h.deps.recover = async () => { assert.fail('Heartbeat while creationWorkRunning must not invoke recover on no-call reply'); };
    await runConciergeControlLoop({ ...input, snapshot: generatingSnapshot, heartbeat: true }, h.deps);
    assert.deepEqual(delivered, [replyText]);
    assert.ok(h.events.includes('task_waiting'));
    assert.equal(h.transcripts.length, 1);
  }
});

test('question-phrased requests trigger Jev recovery and retain the previous observed action receipt', async () => {
  const h = harness([
    { text: "I can't do that right now", calls: [] },
    { text: 'Scrolling now.', calls: [call()] },
    { text: '', calls: [call({ status: 'waiting', detail: 'Picker contents are updating' }, 'finishAutoControlTask')] },
    { text: 'The picker is updating.', calls: [] },
  ]);
  let recovered = 0;
  h.deps.recover = async () => { recovered++; return { status: 'ok', choice: 'continue', reason: 'Scroll is available' }; };
  await runConciergeControlLoop({
    ...input,
    userGoal: 'Could I animate these images now?',
    conversationalTurn: true,
    previousActionEvidence: [{ operation: { kind: 'click', actionId: 'clikb.creation.notepad.action.open_models' }, status: 'observed_change', mutationSent: true }],
  }, h.deps);
  assert.equal(recovered, 1);
  assert.equal(h.executions(), 1);
  assert.ok(h.transcripts[1].some((m: any) => String(m.content || '').includes('clikb.creation.notepad.action.open_models') && String(m.content || '').includes('observed_change')));
});

test('Replicate structured adapter preserves function history and never parses ordinary speech as a call', async () => {
  const prompt = replicateToolPrompt(CONCIERGE_TOOLS, [{ role: 'assistant', tool_calls: [call()], content: null }, { role: 'tool', tool_call_id: 'call_1', content: '{"status":"settled"}' }]);
  assert.ok(prompt.includes('tool_call_id'));
  assert.throws(() => decodeReplicateToolReply('I will use VirtualGate to scroll down', CONCIERGE_TOOLS));
  const decoded = decodeReplicateToolReply(JSON.stringify({ content: null, tool_calls: [{ name: 'virtualGate', arguments: args }] }), CONCIERGE_TOOLS);
  const chunks: any[] = [];
  for await (const chunk of streamReplicateToolReply(decoded)) chunks.push(chunk);
  assert.equal(chunks[0].choices[0].delta.tool_calls?.[0].function.name, 'virtualGate');
  assert.equal(chunks.at(-1)?.choices[0].finish_reason, 'tool_calls');
});
