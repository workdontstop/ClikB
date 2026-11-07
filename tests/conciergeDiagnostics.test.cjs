const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./loadTs.cjs');
const diagnostics = loadTs('src/conciergeDiagnostics.ts');

test('default control logs never serialize or retain full snapshots; voice-frame logs are opt-in', () => {
  const oldWindow = global.window, oldInfo = console.info, oldDebug = console.debug;
  const logs = [], debug = [];
  global.window = { localStorage: { getItem: () => null } };
  console.info = message => logs.push(message);
  console.debug = message => debug.push(message);
  try {
    const snapshot = { route: '/kickit' };
    Object.defineProperty(snapshot, 'largePayload', { enumerable: true, get() { throw new Error('full snapshot was accessed'); } });
    diagnostics.logControlDiagnostic('control', { requestId: 'one', reply: { status: 'observed', snapshot } });
    diagnostics.logVoiceDiagnostic('STT frame', new Array(100000));
    assert.equal(logs.length, 1);
    assert.match(logs[0], /kickit/);
    assert.equal(debug.length, 0);
    assert.equal(typeof logs[0], 'string');
  } finally { global.window = oldWindow; console.info = oldInfo; console.debug = oldDebug; }
});

test('explicit verbose diagnostic output has bounded traversal and handles cycles', () => {
  const value = { text: 'x'.repeat(100000), rows: Array.from({ length: 10000 }, () => ({ text: 'y'.repeat(1000) })) };
  value.self = value;
  const bounded = JSON.stringify(diagnostics.boundedConciergeDiagnostic(value));
  assert.ok(bounded.length < 4000);
  assert.match(bounded, /bounded/);
  assert.equal(value.text.length, 100000, 'diagnostic pruning must not mutate real app state');
});
