const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');

test('reusing a client correlation ID cannot reuse paid provider event identities', () => {
  const ledger = load('server/src/aiUsageLedger.ts', {
    './db': {}, './requestAuth': { authenticatedUserId: () => '101' },
    './meteredUsageBilling': {},
    './conversationMeasurementLedger': { CONVERSATION_MEASUREMENT_HEADER: 'x-clikb-conversation-session' },
  });
  const ids = [];
  for (let n = 0; n < 2; n++) {
    ledger.aiUsageContextMiddleware({ path: '/startBrainstormStream', headers: { 'x-clikb-request-id': 'caller-controlled-repeat' } }, { end() {} }, () => ids.push(ledger.currentUsageRequestId()));
  }
  assert.notEqual(ids[0], ids[1]);
  assert.ok(ids.every(id => id !== 'caller-controlled-repeat'));
});
