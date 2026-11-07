import assert from 'node:assert/strict';
import test from 'node:test';
import { activeFullscreenHeartbeatGoal, detectVirtualGateIntent } from './VirtualGate';
import { accumulateToolCalls, operationId, virtualGateOperation } from './ConciergeTools';

test('fullscreen heartbeat passes the latest real user goal, not the synthetic ping', () => {
  const heartbeat = { role: 'user', content: '[Fullscreen heartbeat — not a new user instruction] Current time: 123' };
  assert.equal(activeFullscreenHeartbeatGoal([
    { role: 'user', content: 'Every 8 secs scroll down as I watch a slideshow' }, heartbeat,
  ]), 'Every 8 secs scroll down as I watch a slideshow');
  assert.equal(activeFullscreenHeartbeatGoal([
    { role: 'user', content: 'Every 8 secs scroll down as I watch a slideshow' },
    { role: 'user', content: 'Stop the slideshow' }, heartbeat,
  ]), 'Stop the slideshow');
  assert.equal(activeFullscreenHeartbeatGoal([
    { role: 'user', content: 'Scroll down once' }, heartbeat,
  ]), 'Scroll down once');
  assert.equal(activeFullscreenHeartbeatGoal([heartbeat]), null);
});

test('VirtualGate requires structured arguments, never spoken prose', () => {
  assert.throws(() => virtualGateOperation('VirtualGate clikb.settings.action.theme_light'));
  assert.throws(() => virtualGateOperation({ kind: 'click', actionId: 'auto_control:on', rationale: 'enable' }));
  assert.throws(() => virtualGateOperation({ kind: 'click', actionId: 'clikb.settings.control.theme_light', rationale: 'theme' }));
});

test('scroll arguments become the exact Jev address including direction', () => {
  const operation = virtualGateOperation({ kind: 'scroll', scrollId: 'clikb.creation.models.action.scroll', direction: 'forward', rationale: 'Find Nano Banana Pro' });
  assert.equal(operationId(operation), 'scroll:clikb.creation.models.action.scroll:forward');
  assert.equal(operationId(virtualGateOperation({ kind: 'scroll', actionId: 'clikb.creation.styles.action.scroll', scrollId: 'clikb.creation.styles.control.scroll', direction: 'forward', textValue: '', rationale: 'Scroll art styles' })), 'scroll:clikb.creation.styles.action.scroll:forward');
  assert.equal(operationId(virtualGateOperation({ kind: 'click', actionId: 'clikb.creation.styles.action.scroll', scrollId: '', direction: 'backward', textValue: '', rationale: 'Scroll art styles up' })), 'scroll:clikb.creation.styles.action.scroll:backward');
  assert.throws(() => virtualGateOperation({ kind: 'scroll', actionId: 'clikb.creation.models.action.scroll', rationale: 'down' }));
});

test('fragmented tool arguments are assembled without executing partial JSON', () => {
  const calls = new Map();
  accumulateToolCalls(calls, [{ index: 0, id: 'call_1', function: { name: 'virtualGate', arguments: '{"kind":' } }]);
  accumulateToolCalls(calls, [{ index: 0, function: { arguments: '"scroll"}' } }]);
  assert.equal(calls.get(0).function.arguments, '{"kind":"scroll"}');
  assert.equal(calls.get(0).function.name, 'virtualGate');
});

test('Jev detects real app control from latest user text, not the marker alone', async () => {
  const result = await detectVirtualGateIntent({ latestUserText: 'Open Settings in ClikB', assistantText: 'I will use VirtualGate.', snapshot: { navigation: { route: '/feeds' } } }, async (input) => {
    assert.equal(input.kind, 'choice');
    assert.equal(input.context?.includes('Open Settings in ClikB'), true);
    assert.equal(input.context?.includes('I will use VirtualGate.'), true);
    return { status: 'ok', answer: { type: 'choice', choice: 'app_action_requested' } };
  });
  assert.deepEqual(result, { status: 'ok', intent: 'app_action_requested' });
  const fictional = await detectVirtualGateIntent({ latestUserText: 'The knight enters the virtual gate', assistantText: 'VirtualGate', snapshot: {} }, async () => ({ status: 'ok', answer: { type: 'choice', choice: 'content_or_conversation' } }));
  assert.equal(fictional.intent, 'content_or_conversation');
  const unavailable = await detectVirtualGateIntent({ latestUserText: 'Open Settings', assistantText: 'VirtualGate', snapshot: {} }, async () => ({ status: 'unavailable', reason: 'timeout' }));
  assert.equal(unavailable.status, 'unavailable');
});

test('Jev sees an active slideshow goal and rationale instead of treating heartbeat text as user intent', async () => {
  await detectVirtualGateIntent({
    latestUserText: 'Every 8 secs scroll down as I watch a slideshow',
    assistantText: "I'll use VirtualGate to advance one post.",
    rationale: 'Advance one post in the active slideshow',
    ongoingAutoControlTask: true,
    snapshot: { navigation: { route: '/feeds' } },
  }, async input => {
    const context = JSON.parse(String(input.context));
    assert.equal(context.latestRealUserGoal, 'Every 8 secs scroll down as I watch a slideshow');
    assert.equal(context.ongoingAutoControlTask, true);
    assert.equal(context.proposedOperation, "I'll use VirtualGate to advance one post.");
    assert.equal(context.rationale, 'Advance one post in the active slideshow');
    return { status: 'ok', answer: { type: 'choice', choice: 'app_action_requested' } };
  });
});

test('intent consultation distinguishes one destination from an either-or question', async () => {
  await detectVirtualGateIntent({
    latestUserText: 'Open my page',
    assistantText: 'Should I use VirtualGate to open your page?',
    snapshot: { navigation: { route: '/feeds' } },
  }, async input => {
    assert.match(input.question, /Does this operation advance the real user task/);
    assert.match(input.question, /unresolved target/);
    assert.match(String(input.optionDescriptions?.clarify), /competing destinations/);
    assert.match(String(input.optionDescriptions?.content_or_conversation), /only discusses VirtualGate/);
    return { status: 'ok', answer: { type: 'choice', choice: 'app_action_requested' } };
  });
});
