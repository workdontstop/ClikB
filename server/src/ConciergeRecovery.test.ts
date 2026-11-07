import assert from 'node:assert/strict';
import test from 'node:test';
import { assessConciergeRecovery, formatRecentControlActions, isConciergeActionGoal, recoveryRagEvidence } from './ConciergeRecovery';

const snapshot = { autoControl: { enabled: true }, creation: { stage: 'confirmation', mode: 'Unselected',
  modeSelectionRequired: true, goBlockedReason: 'Choose Shorts, Games or Cinema to continue.', isGenerating: false,
  controls: { areas: { confirmation: { state: { modeSelectionRequired: true }, controls: [
    { actionId: 'clikb.creation.confirmation.action.mode_cinema', label: 'Cinema', enabled: true, kind: 'click' },
  ] } } } } };
const input = { userGoal: 'Create a cinematic recap and stop before Publish', assistantAssessment: 'I cannot enter the prompt',
  snapshot, recentResults: [{ status: 'dispatched', mutationSent: true }], uncertainExecution: false,
  ragContext: 'All Feeds requires selecting a mode in Confirm setup before Go.' };

test('recovery passes the retained brief, fallible concierge assessment, observed branch, RAG and real action results to Jev', async () => {
  const result = await assessConciergeRecovery(input, async request => {
    const data = JSON.parse(request.context || '{}');
    assert.equal(request.controlFrame?.goal, input.userGoal);
    assert.equal(data.assistantAssessment, input.assistantAssessment);
    assert.equal(data.retrievedRagData, input.ragContext);
    assert.equal(data.recentResults[0].status, 'dispatched');
    assert.equal(JSON.parse(data.observedAppData).creation.modeSelectionRequired, true);
    assert.ok(request.snapshotPointers?.includes('/creation/goBlockedReason'));
    assert.deepEqual(request.options, ['retry', 'continue', 'wait', 'blocked']);
    assert.equal(data.taskBoundary.destination, 'publish');
    assert.equal(data.boundaryReached, false);
    return { status: 'ok', answer: { type: 'choice', choice: 'continue' } };
  });
  assert.equal(result.choice, 'continue');
});

test('running or uncertain generation cannot be assessed as retry or completed', async () => {
  for (const data of [ { ...input, uncertainExecution: true },
    { ...input, snapshot: { ...snapshot, creation: { ...snapshot.creation, isGenerating: true } } } ]) {
    const result = await assessConciergeRecovery(data, async request => {
      assert.deepEqual(request.options, ['wait', 'blocked']);
      return { status: 'ok', answer: { type: 'choice', choice: 'wait' } };
    });
    assert.equal(result.choice, 'wait');
    assert.equal((await assessConciergeRecovery(data, async () => ({ status: 'ok', answer: { type: 'choice', choice: 'retry' } }))).status, 'unavailable');
  }
});

test('Off and absent task never request Jev recovery or additional state', async () => {
  for (const data of [{ ...input, snapshot: { autoControl: { enabled: false } } }, { ...input, userGoal: '' }]) {
    const result = await assessConciergeRecovery(data, async () => { assert.fail('No request is allowed'); });
    assert.equal(result.status, 'unavailable');
  }
});

test('ordinary chat and questions do not become autonomous tasks', () => {
  for (const text of ['Hello', 'How is your day?', 'Why can you not create?', 'Tell me how to generate a story', 'stop'])
    assert.equal(isConciergeActionGoal(text), false, text);
  for (const text of ['Create a cinematic Life 3.0 recap; stop before publish', 'Can you open Notepad?', 'Select Cinema', 'What if we create a dinosaur story?', 'How about opening the Deck?', 'Can I get two images?', 'Could I animate these images now?'])
    assert.equal(isConciergeActionGoal(text), true, text);
  assert.match(formatRecentControlActions([{ operation: { kind: 'click', actionId: 'clikb.creation.workstation_image.action.generate' }, status: 'dispatched', mutationSent: true }]),
    /LAST_CONTROL_ACTION: click clikb\.creation\.workstation_image\.action\.generate \[status=dispatched, mutationSent=true\]/);
});

test('active Creation rules survive a navigation packet larger than the recovery RAG budget', () => {
  const source = 'ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_navigation_shell\n' + 'Navigation content '.repeat(3000)
    + '\nACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\n' + 'Creation content '.repeat(2000)
    + '\nconfirmation: "Only All Feeds requires choosing Cinema before Go."';
  const evidence = recoveryRagEvidence(source, snapshot);
  assert.match(evidence,/clikb_creation/);
  assert.match(evidence,/Only All Feeds requires choosing Cinema/);
  assert.ok(evidence.length<=14000);
});
