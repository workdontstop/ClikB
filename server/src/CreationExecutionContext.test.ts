import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedCreationControl, creationScrollAllowed, findCreationControl, videoPermissionRequested } from './CreationExecutionContext';

const control = { actionId: 'clikb.creation.confirmation.action.go', controlId: 'clikb.creation.confirmation.control.go',
  kind: 'click', enabled: true, policy: 'needs_confirmation', label: 'Confirm and generate' };
const creation = { controls: { areas: { 'clikb.creation.confirmation': { controls: [control] } } } };

test('Creation selection rejects unavailable and handoff controls', () => {
  assert.deepEqual(findCreationControl(creation, control.actionId), control);
  assert.equal(findCreationControl(creation, 'clikb.creation.confirmation.action.missing'), undefined);
  assert.equal(findCreationControl({ controls: { areas: { x: { controls: [{ ...control, policy: 'needs_handoff' }] } } } }, control.actionId), undefined);
});

test('costly Creation action needs target-specific confirmation in latest user text', () => {
  assert.equal(confirmedCreationControl('yes', control), undefined);
  assert.equal(confirmedCreationControl('create my story', control), undefined);
  assert.equal(confirmedCreationControl('confirm generate', control), control.controlId);
  assert.equal(confirmedCreationControl('confirm delete a world', control), undefined);
});

test('Creation scroll cannot move beyond measured boundary', () => {
  const scroll = { ...control, actionId: 'clikb.creation.models.action.scroll', kind: 'scroll', policy: 'candidate',
    canScrollForward: true, canScrollBackward: false };
  const current = { controls: { areas: { models: { controls: [scroll] } } } };
  assert.equal(creationScrollAllowed(current, scroll.actionId, 'forward'), true);
  assert.equal(creationScrollAllowed(current, scroll.actionId, 'backward'), false);
});

test('natural Video permission requests exclude questions, negations and turning Video off', () => {
  for (const text of ['enable video', 'can you turn on video permission?', 'click the video button', 'video permission granted']) {
    assert.equal(videoPermissionRequested(text), true, text);
  }
  for (const text of ['how do I enable video?', 'can I turn on video?', 'do not enable video', 'click Video Off', 'turn off video', 'video is off', 'continue']) {
    assert.equal(videoPermissionRequested(text), false, text);
  }
});

test('Yes applies only to the current destructive confirmation and never overrides Keep or denial', () => {
  const deletion = { ...control, actionId: 'clikb.creation.workstation_motion_guide.action.confirm_delete',
    controlId: 'clikb.creation.workstation_motion_guide.control.confirm_delete', label: 'Delete Motion Guide' };
  assert.equal(confirmedCreationControl('yes', deletion), deletion.controlId);
  assert.equal(confirmedCreationControl('confirm Delete Motion Guide', deletion), deletion.controlId);
  for (const text of ['keep it', 'do not Delete Motion Guide', 'how do I Delete Motion Guide?', 'not yet']) {
    assert.equal(confirmedCreationControl(text, deletion), undefined, text);
  }
  assert.equal(confirmedCreationControl('yes', { ...deletion, policy: 'candidate' }), undefined);
});
