import assert from 'node:assert/strict';
import test from 'node:test';
import { autoControlStateAnswer, isAutoControlStateQuestion } from './AutoControlIntent';

test('read-only control status and capability questions do not become permission changes', () => {
  for (const question of ['Is control on?', 'Is Auto Control off?', 'Do I have Auto Control on?', 'What is the Auto Control status?', 'Can you control parts of this app?']) {
    assert.equal(isAutoControlStateQuestion(question), true, question);
  }
  for (const command of ['Turn on Auto Control', 'Click Settings', 'How do I turn on Auto Control?']) {
    assert.equal(isAutoControlStateQuestion(command), false, command);
  }
});

test('live-state answer distinguishes Off, hidden, On, Guide Off and unknown', () => {
  assert.match(autoControlStateAnswer({ autoControl: { enabled: false, visible: true, conciergeEnabled: true } }), /Auto Control is Off.*pill is visible/);
  assert.match(autoControlStateAnswer({ autoControl: { enabled: false, visible: false, conciergeEnabled: true } }), /Off and hidden.*show the pill/);
  assert.match(autoControlStateAnswer({ autoControl: { enabled: true, visible: true, conciergeEnabled: true } }), /Auto Control is On/);
  assert.match(autoControlStateAnswer({ autoControl: { enabled: false, visible: false, conciergeEnabled: false } }), /Guide Mode is Off/);
  assert.match(autoControlStateAnswer(null), /can't confirm/);
});
