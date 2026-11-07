const test = require('node:test');
const assert = require('node:assert/strict');
const { MeteredReceiptState, MeteredWalletRefresh, isCurrentMeteredReceipt } = require('./loadTs.cjs')('src/meteredReceiptState.ts');

test('streamed and polled receipt replay displays each debit once and never rewinds that session balance', () => {
  const state = new MeteredReceiptState();
  const newer = { receiptId: 'new', sessionKey: 'account', receiptSeq: 3 };
  assert.deepEqual(state.accept(newer), { fresh: true, updateBalance: true });
  assert.deepEqual(state.accept(newer), { fresh: false, updateBalance: false });
  assert.deepEqual(state.accept({ receiptId: 'voice-old', sessionKey: 'account', receiptSeq: 2 }), { fresh: true, updateBalance: false });
  assert.equal(state.cursor('account'), 0, 'direct events must not skip unseen binary receipts');
  state.advance('account', 3); state.advance('account', 2);
  assert.equal(state.cursor('account'), 3);
  assert.deepEqual(state.accept({ receiptId: 'pending', pendingReconciliation: true }), { fresh: true, updateBalance: false });
});

test('receipt display/cursor survives refresh without replaying deductions and tolerates unavailable storage', async () => {
  let stored = null, writes = 0;
  const persistence = { load: () => stored, save: value => { stored = value; writes++; } };
  const state = new MeteredReceiptState(persistence);
  state.accept({ receiptId: 'one', sessionKey: 'account', receiptSeq: 1 });
  state.accept({ receiptId: 'two', sessionKey: 'account', receiptSeq: 2 });
  state.advance('account', 2);
  await Promise.resolve();
  assert.equal(writes, 1, 'one receipt batch causes one bounded storage write');
  const refreshed = new MeteredReceiptState(persistence);
  assert.equal(refreshed.cursor('account'), 2);
  assert.deepEqual(refreshed.accept({ receiptId: 'two', sessionKey: 'account', receiptSeq: 2 }), { fresh: false, updateBalance: false });
  const privateStorage = new MeteredReceiptState({ load() { throw new Error('denied'); }, save() { throw new Error('denied'); } });
  assert.equal(privateStorage.accept({ receiptId: 'new' }).fresh, true);
  await Promise.resolve();
});

test('late receipt delivery after logout/account switch cannot update another account wallet', () => {
  assert.equal(isCurrentMeteredReceipt({ userId: '7', sessionKey: 'concierge:7:account' }, 7), true);
  assert.equal(isCurrentMeteredReceipt({ userId: '7' }, 42), false);
  assert.equal(isCurrentMeteredReceipt({ sessionKey: 'concierge:7:account' }, null), false);
  assert.equal(isCurrentMeteredReceipt({ sessionKey: 'concierge:7:account' }, 42), false);
  assert.equal(isCurrentMeteredReceipt({ pendingReconciliation: true }, 7), true);
});

test('a delayed voice balance read cannot undo a later image debit or top-up', async () => {
  for (const updatedBalance of [80, 110]) {
    let state = { userId: '7', revision: 0 }, release, reads = 0;
    const applied = [];
    const first = new Promise(resolve => { release = resolve; });
    const refresh = new MeteredWalletRefresh(() => state, async () => ++reads === 1 ? first : updatedBalance, balance => applied.push(balance));
    const running = refresh.request();
    state = { userId: '7', revision: 1 }; // A later media response/credit was observed.
    release(85);
    await running;
    assert.deepEqual(applied, [updatedBalance]);
    assert.equal(reads, 2);
  }
});

test('fresh wallet refresh is coalesced, bounded and ignores late reads for a logged-out user', async () => {
  let state = { userId: '7', revision: 0 }, release, reads = 0;
  const applied = [], first = new Promise(resolve => { release = resolve; });
  const refresh = new MeteredWalletRefresh(() => state, async () => { reads++; return first; }, balance => applied.push(balance));
  const pending = Array.from({ length: 20 }, () => refresh.request());
  state = { userId: '42', revision: 0 };
  release(90);
  await Promise.all(pending);
  assert.equal(reads, 1);
  assert.deepEqual(applied, []);
});
