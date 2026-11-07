const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./loadTs.cjs');
const { createMeteredSqlHarness } = require('./helpers/meteredSqlHarness.cjs');
const load = harness => {
  const env = harness.makeEnv();
  return loadTs('server/src/meteredUsageBilling.ts', { './execQuery': env.execQuery, './db': env.db });
};
const params = { sessionKey: 'concierge:101:accounting', userId: '101', workload: 'concierge', profile: 'terra', model: 'gpt-6.1-terra', forceReceipt: true, throwOnError: true };
const event = (id, rawPixels) => ({ ...params, eventId: id, rawPixels });

test('queued first-session events total 1.8 P, charge 1 P, and retain 0.8 P without optimistic double counting', async () => {
  const harness = createMeteredSqlHarness([['101', 10]]), billing = load(harness);
  const increments = ['a', 'b', 'c'].map(id => billing.accumulateMeteredUsage(event(id, 0.6)));
  await Promise.all(increments);
  const receipt = await billing.settleMeteredSession(params);
  assert.equal(receipt.cumulativeSubunits, 1_800_000_000);
  assert.equal(receipt.pixelsCharged, 1);
  assert.equal(receipt.carrySubunits, 800_000_000);
  assert.equal(harness.state.members.get('101'), 9);
  assert.equal(harness.state.events.size, 3);
});

test('failed event acceptance stays retryable and restart replay never charges the event twice', async () => {
  const harness = createMeteredSqlHarness([['101', 10]]), billing = load(harness);
  harness.state.failQuery = sql => { if (sql.startsWith('INSERT INTO ai_metered_billing_events')) throw new Error('storage unavailable'); };
  await assert.rejects(billing.accumulateMeteredUsage(event('provider-response', 1.6)), /storage unavailable/);
  assert.equal(harness.state.events.size, 0);
  assert.equal(harness.state.sessions.size, 0);
  assert.equal(billing.getMeteredSessionSnapshot(params.sessionKey), null);
  harness.state.failQuery = null;
  await billing.accumulateMeteredUsage(event('provider-response', 1.6));
  const paid = await billing.settleMeteredSession(params);
  assert.equal(paid.pixelsCharged, 1);
  const restarted = load(harness);
  const replay = await restarted.accumulateMeteredUsage(event('provider-response', 1.6));
  assert.equal(replay.addedSubunits, 0);
  assert.equal((await restarted.settleMeteredSession({ ...params, idempotencyKey: 'reconnect' })).pixelsCharged, 0);
  assert.equal(harness.state.members.get('101'), 9);
});

test('compound application failure rolls back event, debit, receipt and published memory together', async () => {
  const harness = createMeteredSqlHarness([['101', 20]]), billing = load(harness);
  await assert.rejects(billing.withMeteredSessionTransaction(params, async (_query, settle) => {
    assert.equal((await settle(event('build-step', 6.4))).pixelsCharged, 6);
    throw new Error('checkpoint failed');
  }), /checkpoint failed/);
  assert.equal(harness.state.members.get('101'), 20);
  assert.equal(harness.state.events.size, 0);
  assert.equal(harness.state.receipts.size, 0);
  assert.equal(billing.getMeteredSessionSnapshot(params.sessionKey), null);
  const receipt = await billing.withMeteredSessionTransaction(params, async (_query, settle) => settle(event('build-step', 6.4)));
  assert.equal(receipt.pixelsCharged, 6);
  assert.equal(harness.state.members.get('101'), 14);
});

test('commit failure does not publish accepted usage or receipts; same identity can retry', async () => {
  const harness = createMeteredSqlHarness([['101', 20]]), billing = load(harness);
  harness.state.beforeCommit = () => { throw new Error('commit failed'); };
  await assert.rejects(billing.accumulateMeteredUsage(event('event', 2.4)), /commit failed/);
  assert.equal(harness.state.events.size, 0);
  assert.equal(billing.getMeteredSessionSnapshot(params.sessionKey), null);
  harness.state.beforeCommit = null;
  await billing.accumulateMeteredUsage(event('event', 2.4));
  harness.state.beforeCommit = () => { throw new Error('commit failed'); };
  await assert.rejects(billing.settleMeteredSession(params), /commit failed/);
  assert.equal(harness.state.members.get('101'), 20);
  assert.equal(billing.getMeteredSessionSnapshot(params.sessionKey).settledWholePixels, 0);
  harness.state.beforeCommit = null;
  assert.equal((await billing.settleMeteredSession(params)).pixelsCharged, 2);
});

test('separate workers and concurrent settlement use committed cumulative state', async () => {
  const harness = createMeteredSqlHarness([['101', 100]]), first = load(harness), second = load(harness);
  await Promise.all([first.accumulateMeteredUsage(event('a', 0.6)), second.accumulateMeteredUsage(event('b', 0.6)), first.accumulateMeteredUsage(event('c', 0.6))]);
  const receipts = await Promise.all([first.settleMeteredSession({ ...params, idempotencyKey: 'worker-a' }), second.settleMeteredSession({ ...params, idempotencyKey: 'worker-b' })]);
  assert.equal(receipts.reduce((sum, receipt) => sum + receipt.pixelsCharged, 0), 1);
  assert.equal(harness.state.members.get('101'), 99);
  assert.equal(harness.state.sessions.get(params.sessionKey).cumulative_subunits, 1_800_000_000);
});

test('duplicates/nonbillable events resolve ordinary promises and conflicting replay is rejected', async () => {
  const harness = createMeteredSqlHarness(), billing = load(harness);
  await billing.accumulateMeteredUsage(event('a', 0.6));
  const duplicate = await billing.accumulateMeteredUsage(event('a', 0.6));
  assert.equal(duplicate.addedSubunits, 0);
  assert.equal(duplicate.then, undefined);
  assert.equal((await billing.accumulateMeteredUsage({ ...event('helper', 100), billableToUser: false })).addedSubunits, 0);
  await assert.rejects(billing.accumulateMeteredUsage(event('a', 2)), error => error.code === 'USAGE_EVENT_CONFLICT');
  assert.equal(harness.state.events.size, 1);
});

test('usage inputs are captured at enqueue time and unavailable balance remains unknown', async () => {
  const harness = createMeteredSqlHarness(), billing = load(harness);
  const input = event('immutable', 1.6);
  const pending = billing.accumulateMeteredUsage(input);
  input.rawPixels = 100;
  await pending;
  assert.equal(harness.state.sessions.get(params.sessionKey).cumulative_subunits, 1_600_000_000);
  harness.state.failNextTransaction = true;
  const receipt = await billing.settleMeteredSession({ ...params, throwOnError: false });
  assert.equal(receipt.pendingReconciliation, true);
  assert.equal(receipt.pixelsCharged, 0);
  assert.equal(harness.state.members.get('101'), 100);
  harness.state.members.delete('101');
  harness.state.failNextTransaction = true;
  const unknown = await billing.settleMeteredSession({ ...params, throwOnError: false });
  assert.equal(unknown.pendingReconciliation, true);
  assert.equal(unknown.remainingPixels, undefined);
});

test('confirmed unpaid usage can settle after a top-up without replaying an earlier zero-debit attempt', async () => {
  const harness = createMeteredSqlHarness([['101', 0]]), billing = load(harness);
  await billing.accumulateMeteredUsage(event('completed-provider-step', 3.4));
  const empty = await billing.settleMeteredSession(params);
  assert.equal(empty.pixelsCharged, 0);
  assert.equal(empty.unsettledWholePixels, 3);
  harness.state.members.set('101', 10);
  const settled = await billing.settleMeteredSession(params);
  assert.equal(settled.pixelsCharged, 3);
  assert.equal(settled.unsettledWholePixels, 0);
  assert.equal(harness.state.members.get('101'), 7);
});

test('durable receipt feed is ordered, bounded and scoped to authenticated owner', async () => {
  const harness = createMeteredSqlHarness(), billing = load(harness);
  for (const id of ['a', 'b', 'c']) {
    await billing.accumulateMeteredUsage(event(id, 1.1));
    await billing.settleMeteredSession(params);
  }
  const feed = await load(harness).readMeteredSessionReceipts({ ...params, afterReceiptSeq: 1, limit: 1 });
  assert.equal(feed.length, 1);
  assert.equal(feed[0].receiptSeq, 2);
  assert.equal(feed[0].pixelsCharged, 1);
  assert.equal(feed[0].replayed, false);
  const foreign = await billing.readMeteredSessionReceipts({ ...params, userId: '202' });
  assert.deepEqual(foreign, []);
});

test('accepted usage whose debit fails schedules settlement recovery without inventing another usage event', async () => {
  const harness = createMeteredSqlHarness([['101', 10]]), billing = load(harness);
  const retries = [];
  billing.configureMeteredSettlementFailureHandler(async pending => { retries.push(pending); });
  await billing.accumulateMeteredUsage(event('tts-finished', 3.2));
  harness.state.failQuery = sql => { if (sql.startsWith('UPDATE members')) throw new Error('wallet unavailable'); };
  const pending = await billing.settleMeteredSession({ ...params, throwOnError: false });
  assert.equal(pending.pendingReconciliation, true);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].sessionKey, params.sessionKey);
  assert.equal(harness.state.events.size, 1);
  assert.equal(harness.state.members.get('101'), 10);
  harness.state.failQuery = null;
  const recovered = await billing.settleMeteredSession(retries[0]);
  assert.equal(recovered.pixelsCharged, 3);
  assert.equal(harness.state.events.size, 1);
  assert.equal(harness.state.members.get('101'), 7);
});
