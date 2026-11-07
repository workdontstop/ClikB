const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function loadTsModule(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name + '.ts');
      return loadTsModule(path.relative(path.resolve(__dirname, '..'), target), mocks, cache);
    }
    return Module.prototype.require.call(mod, name);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  mod._compile(output, filename);
  return mod.exports;
}

test('sub-pixel math settles whole pixels and carries exact remainder across calls', async () => {
  const balances = new Map([['user-1', 100]]);
  const metered = loadTsModule('server/src/meteredUsageBilling.ts', {
    './execQuery': Object.assign(async () => [], {
      withTransaction: async () => {
        throw new Error('Use test adapter');
      },
    }),
    './db': {
      getPixelsForUser: async (u) => balances.get(u) ?? 0,
      trySpendPixels: async (u, p) => {
        const cur = balances.get(u) ?? 0;
        if (cur < p) return false;
        balances.set(u, cur - p);
        return true;
      },
    },
  });

  metered.__resetMeteredBillingStateForTest();
  metered.__setMeteredBillingTestAdapter({
    getBalance: async (u) => balances.get(u) ?? 0,
    spendPixels: async (u, p) => {
      const cur = balances.get(u) ?? 0;
      if (cur < p) return { ok: false, balance: cur };
      const next = cur - p;
      balances.set(u, next);
      return { ok: true, balance: next };
    },
  });

  const sessionKey = metered.buildMeteredSessionKey('concierge', 'user-1', 'sess-237');
  await metered.accumulateMeteredUsage({
    sessionKey,
    userId: 'user-1',
    surface: 'concierge',
    tier: 'terra',
    eventId: 'call-1',
    rawPixels: 23.7,
    billableToUser: true,
  });

  const receipt1 = await metered.settleMeteredSession({
    sessionKey,
    userId: 'user-1',
    surface: 'concierge',
    tier: 'terra',
    idempotencyKey: 'tick-1',
  });

  assert.equal(receipt1.pixelsCharged, 23);
  assert.equal(receipt1.remainingPixels, 77);
  assert.equal(receipt1.carriedSubunits, 700_000_000);
  assert.equal(receipt1.zeroBalanceReached, false);

  // Two 0.57 P calls in a fresh session -> 1.14 P -> 1 P settled, 0.14 P carried
  const sessionKey2 = metered.buildMeteredSessionKey('concierge', 'user-1', 'sess-057');
  await metered.accumulateMeteredUsage({
    sessionKey: sessionKey2,
    userId: 'user-1',
    surface: 'concierge',
    tier: 'luna_xhigh',
    eventId: 'call-a',
    rawPixels: 0.57,
  });
  await metered.accumulateMeteredUsage({
    sessionKey: sessionKey2,
    userId: 'user-1',
    surface: 'concierge',
    tier: 'luna_xhigh',
    eventId: 'call-b',
    rawPixels: 0.57,
  });

  const receipt2 = await metered.settleMeteredSession({
    sessionKey: sessionKey2,
    userId: 'user-1',
    surface: 'concierge',
    tier: 'luna_xhigh',
    idempotencyKey: 'tick-2',
  });
  assert.equal(receipt2.pixelsCharged, 1);
  assert.equal(receipt2.remainingPixels, 76);
  assert.equal(receipt2.carriedSubunits, 140_000_000);
});

test('eventId and idempotencyKey prevent duplicate accumulation or double debit', async () => {
  const balances = new Map([['user-2', 50]]);
  const metered = loadTsModule('server/src/meteredUsageBilling.ts', {
    './execQuery': Object.assign(async () => [], { withTransaction: async () => { throw new Error('adapter'); } }),
    './db': { getPixelsForUser: async (u) => balances.get(u) ?? 0, trySpendPixels: async () => true },
  });

  metered.__resetMeteredBillingStateForTest();
  metered.__setMeteredBillingTestAdapter({
    getBalance: async (u) => balances.get(u) ?? 0,
    spendPixels: async (u, p) => {
      const cur = balances.get(u) ?? 0;
      const next = cur - p;
      balances.set(u, next);
      return { ok: true, balance: next };
    },
  });

  const sessionKey = metered.buildMeteredSessionKey('voice', 'user-2', 'voice-sess');
  const firstAdd = await metered.accumulateMeteredUsage({
    sessionKey,
    userId: 'user-2',
    surface: 'voice',
    tier: 'terra',
    eventId: 'dup-event-1',
    rawPixels: 4.4,
  });
  const duplicateAdd = await metered.accumulateMeteredUsage({
    sessionKey,
    userId: 'user-2',
    surface: 'voice',
    tier: 'terra',
    eventId: 'dup-event-1',
    rawPixels: 4.4,
  });

  assert.equal(firstAdd.addedSubunits, 4_400_000_000);
  assert.equal(duplicateAdd.addedSubunits, 0);

  const settle1 = await metered.settleMeteredSession({
    sessionKey,
    userId: 'user-2',
    surface: 'voice',
    tier: 'terra',
    idempotencyKey: 'same-receipt-key',
  });
  const settle2 = await metered.settleMeteredSession({
    sessionKey,
    userId: 'user-2',
    surface: 'voice',
    tier: 'terra',
    idempotencyKey: 'same-receipt-key',
  });

  assert.equal(settle1.pixelsCharged, 4);
  assert.equal(settle2.pixelsCharged, 4);
  assert.equal(balances.get('user-2'), 46);
});

test('zero-balance guard blocks < 1 P admission and caps mid-run settlement at 0 P without negative balance', async () => {
  const balances = new Map([['user-zero', 0], ['user-low', 2]]);
  const metered = loadTsModule('server/src/meteredUsageBilling.ts', {
    './execQuery': Object.assign(async () => [], { withTransaction: async () => { throw new Error('adapter'); } }),
    './db': { getPixelsForUser: async (u) => balances.get(u) ?? 0, trySpendPixels: async () => true },
  });

  metered.__resetMeteredBillingStateForTest();
  metered.__setMeteredBillingTestAdapter({
    getBalance: async (u) => balances.get(u) ?? 0,
    spendPixels: async (u, p) => {
      const cur = balances.get(u) ?? 0;
      if (cur < p) return { ok: false, balance: cur };
      const next = cur - p;
      balances.set(u, next);
      return { ok: true, balance: next };
    },
  });

  const guardZero = await metered.checkMeteredZeroBalanceGuard('user-zero', 1);
  assert.equal(guardZero.allowed, false);
  assert.equal(guardZero.balance, 0);

  const sessionKey = metered.buildMeteredSessionKey('concierge', 'user-low', 'sess-cap');
  await metered.accumulateMeteredUsage({
    sessionKey,
    userId: 'user-low',
    surface: 'concierge',
    tier: 'sol_low',
    eventId: 'big-step',
    rawPixels: 5.3,
  });

  const receipt = await metered.settleMeteredSession({
    sessionKey,
    userId: 'user-low',
    surface: 'concierge',
    tier: 'sol_low',
    idempotencyKey: 'cap-tick',
  });

  assert.equal(receipt.pixelsCharged, 2);
  assert.equal(receipt.remainingPixels, 0);
  assert.equal(receipt.zeroBalanceReached, true);
  assert.equal(balances.get('user-low'), 0);
});

test('aiUsageLedger marks Jev and FAL embedding calls as non-billable and enforces settlement barrier on fixed route failure', async () => {
  let balance = 20;
  let refundCount = 0;
  const ledger = loadTsModule('server/src/aiUsageLedger.ts', {
    './execQuery': Object.assign(async () => [], { withTransaction: async () => { throw new Error('adapter'); } }),
    './db': {
      getPixelsForUser: async () => balance,
      trySpendPixels: async (_u, p) => {
        if (balance < p) return false;
        balance -= p;
        return true;
      },
      addPixelsToUser: async (_u, p) => {
        refundCount += 1;
        await new Promise((r) => setTimeout(r, 15));
        balance += p;
      },
    },
    './requestAuth': {
      authenticatedUserId: () => 'user-fixed',
    },
    './conversationMeasurementLedger': {
      appendConversationMeasurement: () => {},
    },
  });

  // Verify billable vs non-billable cursor isolation
  const req = {
    path: '/startBrainstormStream',
    method: 'POST',
    headers: { 'x-clikb-conversation-session': 'sess-1' },
    body: {},
  };
  const res = {
    statusCode: 200,
    on() {},
    setHeader() {},
    end() { return this; },
  };

  await new Promise((resolve) => {
    ledger.aiUsageContextMiddleware(req, res, () => {
      const cursor = ledger.providerUsageCursor();
      ledger.recordJevUsage('jev-moderation', { usage: { prompt_tokens: 500, completion_tokens: 50 } });
      ledger.recordFalEmbeddingUsage('fal-ai/bagel', 1200);
      assert.equal(ledger.billableProviderCallsSince(cursor).length, 0);
      assert.equal(ledger.billableProviderPixelsSince(cursor), 0);

      ledger.recordOpenAiUsage('gpt-6.1-terra', {
        model: 'gpt-6.1-terra',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
      const billableCalls = ledger.billableProviderCallsSince(cursor);
      assert.equal(billableCalls.length, 1);
      assert.equal(billableCalls[0].model, 'gpt-6.1-terra');
      assert.ok(ledger.billableProviderPixelsSince(cursor) > 0);
      resolve();
    });
  });

  // Verify withFixedAiPixelCharge settlement barrier waits for async refund before flushing res.end
  const headers = new Map();
  let endedPayload = null;
  let balanceAtEnd = null;
  const fixedReq = {
    path: '/startPlanVid',
    method: 'POST',
    headers: {},
    body: {},
  };
  const fixedRes = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) { headers.set(k, String(v)); },
    status(c) { this.statusCode = c; return this; },
    json(payload) {
      this.end(JSON.stringify(payload));
      return this;
    },
    end(chunk) {
      endedPayload = chunk;
      balanceAtEnd = balance;
      return this;
    },
  };

  const wrapped = ledger.withFixedAiPixelCharge(async (_rq, rs) => {
    // At handler execution time, 13 P was held upfront
    assert.equal(balance, 7);
    rs.status(500).json({ message: 'Simulated downstream failure' });
  }, { pixels: 13, stage: 'video_prompt', actionLabel: 'Video Plan' });

  await wrapped(fixedReq, fixedRes, () => {});
  // Wait briefly for the async refund barrier to invoke originalEnd
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(refundCount, 1);
  assert.equal(balance, 20);
  assert.equal(balanceAtEnd, 20);
  assert.equal(headers.get('X-ClikB-Pixels-Charged'), '0');
  assert.equal(headers.get('X-ClikB-Pixels-Balance'), '20');
  assert.ok(String(endedPayload).includes('Simulated downstream failure'));
});

test('Three.js liveSceneBuilds periodic settlement rebases required balance and deducts only unsettled delta on completion', async () => {
  const harness = require('./helpers/meteredSqlHarness.cjs').createMeteredSqlHarness([['user-3d', 10]]);
  const env = harness.makeEnv();
  let securityGuardFn = null;
  const recordedCharges = [];
  const validPlan = {
    version: 1,
    duration: 5,
    background: '#111111',
    objects: [
      {
        id: 'actor',
        shape: 'box',
        color: '#ffffff',
        keys: [
          { t: 0, position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          { t: 5, position: [1, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        ],
      },
    ],
    camera: [
      { t: 0, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 },
      { t: 5, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 },
    ],
  };

  let rawSegmentPixels = 6.4;
  let resolveStreamHold;
  const streamHold = new Promise((r) => { resolveStreamHold = r; });

  const liveBuilds = loadTsModule('server/src/liveSceneBuilds.ts', {
    './execQuery': env.execQuery,
    './db': env.db,
    './requestAuth': { authenticatedUserId: () => 'user-3d' },
    './aiUsageLedger': {
      recordPixelCharge: (p) => recordedCharges.push(p),
      providerUsageCursor: () => 0,
      providerPixelsSince: () => rawSegmentPixels,
    },
    './liveBuildSecurity': {
      guardLiveBuild: (checkFn) => {
        securityGuardFn = checkFn;
        return () => {};
      },
    },
    './liveSceneModelClient': {
      createLiveSceneModelClient: () => ({}),
      LIVE_SCENE_REQUEST_TIMEOUT_MS: 600000,
    },
    './textGeneration': {
      streamRoutedChatText: async function* () {
        yield { type: 'meta', model: 'gpt-6.1-terra', provider: 'openai', liveStreaming: true };
        await streamHold;
        yield { type: 'done', text: JSON.stringify(validPlan), usage: {}, model: 'gpt-6.1-terra', provider: 'openai', liveStreaming: true };
      },
    },
  });

  liveBuilds.registerLivePreparer('motion', async () => ({
    kind: 'motion',
    operation: 'build',
    price: 1,
    atCostPricing: true,
    tier: 'terra',
    planPath: [],
    duration: 5,
    request: { model: 'gpt-6.1-terra', messages: [{ role: 'system', content: 'sys' }] },
    finalize: async (raw) => ({ plan: raw }),
    charge: async () => ({}),
    recordUsage: () => {},
  }));

  const events = [];
  const closeHandlers = [];
  const res = {
    destroyed: false,
    status() { return this; },
    setHeader() {},
    flushHeaders() {},
    write(line) {
      for (const part of String(line).trim().split('\n')) {
        if (part) events.push(JSON.parse(part));
      }
    },
    end() {
      for (const fn of closeHandlers) fn();
    },
    on(evt, fn) {
      if (evt === 'close') closeHandlers.push(fn);
    },
  };

  await liveBuilds.handleLiveRequest({ body: { live: true, liveTargetKey: 'shot-1' } }, res, 'motion', 'user-3d');
  const sessions = [...liveBuilds.__liveSessionsForTest.values()];
  assert.equal(sessions.length, 1);
  const session = sessions[0];

  // Simulate step 1 accruing 6.4 raw P while balance is 10 P
  session.rawProviderPixels = 6.4;
  // Trigger the 10-second security/settlement tick: settles 6 whole P, leaving balance = 4 P.
  // Without rebasing, a subsequent tick would see balance (4) < ceil(6.4) (7) and falsely fail!
  const balanceAfterTick1 = await securityGuardFn();
  assert.equal(balanceAfterTick1, 4);
  assert.equal(session.settledWholePixels, 6);

  // Second tick with no new usage must succeed because remaining unsettled is ceil(6.4 - 6) = 1 <= 4 P
  const balanceAfterTick2 = await securityGuardFn();
  assert.equal(balanceAfterTick2, 4);

  // Now let the segment finish (adding another 0.0 rawPixels if we set rawSegmentPixels = 0)
  rawSegmentPixels = 0;
  resolveStreamHold();
  await session.running;

  // Total floor(6.4) = 6 P with 0.4 P carry; 6 P was already settled, so finalization charges 0 additional whole P -> final balance = 4 P
  assert.equal(harness.state.members.get('user-3d'), 4);
  assert.deepEqual(recordedCharges, [6]);
  const meteredEvents = events.filter((e) => e.type === 'metered-billing');
  assert.equal(meteredEvents.length, 1);
  assert.equal(meteredEvents[0].pixelsCharged, 6);
});

test('per-scene video prompt billing ignores llmBatchContinuation when operationCount is 1 and separates luna vs luna_extra cache keys', async () => {
  const balances = new Map([['user-vid', 20]]);
  const llmBilling = loadTsModule('server/src/llmBilling.ts', {
    './db': {
      getPixelsForUser: async (u) => balances.get(u) ?? 0,
      trySpendPixels: async (u, p) => {
        const cur = balances.get(u) ?? 0;
        if (cur < p) return false;
        balances.set(u, cur - p);
        return true;
      },
      addPixelsToUser: async (u, p) => {
        balances.set(u, (balances.get(u) ?? 0) + p);
      },
    },
    './requestAuth': { authenticatedUserId: () => 'user-vid' },
    './aiUsageLedger': {
      recordPixelCharge() {},
      recordUsagePixelBalance() {},
      replayUsageOperation() {},
      runUsageOperation: async (op, work, opts) => {
        const res = await work();
        opts?.onComplete?.({ requestId: `req-${op.operationKey}`, stage: op.stage || 'video_prompt', actionLabel: op.actionLabel || 'Video Prompt', pixelsCharged: res.billing?.pixelsCharged || 0, calls: [] });
        return res;
      },
    },
  });

  // Even if an older client passes llmBatchContinuation: true, operationCount: 1 charges every scene
  const reqScene2 = { body: { llmTier: 'terra', llmBatchContinuation: true } };
  const resScene2 = { status() { return this; }, send() { return this; } };
  const resolved = await llmBilling.beginLlmRequest(reqScene2, resScene2, 'gpt-6-luna', { operationCount: 1 });
  assert.ok(resolved);
  assert.ok(resolved.charge);
  assert.equal(resolved.charge.pixels, 5);
  const charged = await llmBilling.completeLlmCharge(resolved.charge);
  assert.equal(charged.pixelsCharged, 5);
  assert.equal(balances.get('user-vid'), 15);

  // luna (1 P, low) and luna_extra (2 P, high) share model gpt-6-luna but must not collide in operation cache
  const op = { operationKey: 'scene-op-1', fingerprint: 'fp-1', stage: 'image_prompt', actionLabel: 'Image Prompt' };
  const llmLuna = await llmBilling.beginLlmRequest({ body: { llmTier: 'luna' } }, resScene2, 'gpt-6-luna', { operations: [op] });
  await llmBilling.runBilledLlmOperation(llmLuna, op, async () => 'luna-result');
  assert.equal(llmBilling.llmOperationIsCached({ ...op, userId: 'user-vid', tier: 'luna' }), true);
  assert.equal(llmBilling.llmOperationIsCached({ ...op, userId: 'user-vid', tier: 'luna_extra' }), false);
});

test('LiveSceneClient registerViewportOwner preserves active checkpoint capture across multiple mounted workspaces and records metered-billing events', () => {
  const { LiveSceneClient } = loadTsModule('src/liveSceneClient.ts', {
    './liveSceneDiagnostics': { liveSceneLog() {}, exportLiveSceneLogs: () => '' },
  });
  const client = new LiveSceneClient('http://localhost:3001', 'target-1');
  const plan = {
    version: 1,
    duration: 5,
    background: '#111111',
    objects: [],
    camera: [{ t: 0, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 }, { t: 5, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 }],
  };

  const unregisterInline = client.registerViewportOwner({
    expanded: false,
    capture: () => 'data:image/jpeg;base64,inline',
    captureCheckpoint: () => 'data:image/jpeg;base64,inline-cp',
  });
  const unregisterExpanded = client.registerViewportOwner({
    expanded: true,
    capture: () => 'data:image/jpeg;base64,expanded',
    captureCheckpoint: () => 'data:image/jpeg;base64,expanded-cp',
  });

  // Unmounting expanded workspace must fall back cleanly to inline owner instead of clearing captureCheckpoint
  unregisterExpanded();
  assert.equal(client.capture(), 'data:image/jpeg;base64,inline');
  assert.equal(client.captureCheckpoint(plan), 'data:image/jpeg;base64,inline-cp');
  unregisterInline();

  // Metered billing event updates lastMeteredBilling and balance header callback
  let reportedBalance = null;
  client.onResponse = (resp) => {
    reportedBalance = resp.headers.get('x-clikb-pixels-balance');
  };
  client.event({ type: 'metered-billing', buildId: 'build-1', seq: 2, pixelsCharged: 3, settledWholePixels: 5, pixels: 42 });
  assert.equal(reportedBalance, '42');
  assert.equal(client.snapshot().lastMeteredBilling.pixelsCharged, 3);
  assert.equal(client.snapshot().lastMeteredBilling.settledWholePixels, 5);
});

test('F01 & F08: policy version admission gate downgrades stale paid requests to free Luna and anonymous paid endpoints reject with 401 without debiting user 1', async () => {
  const models = loadTsModule('server/src/conversationModels.ts');
  const stale = models.resolveAdmittedConversationProfile('terra', { policyVersion: undefined });
  assert.equal(stale.tier, 'luna');
  assert.equal(stale.requestedTier, 'terra');
  assert.equal(stale.policyMigrated, true);

  const admitted = models.resolveAdmittedConversationProfile('terra', {
    policyVersion: models.CONVERSATION_PROFILE_POLICY_VERSION,
  });
  assert.equal(admitted.tier, 'terra');
  assert.equal(Boolean(admitted.policyMigrated), false);

  let user1Balance = 500;
  const voiceTts = loadTsModule('server/src/VoiceTts.ts', {
    './conversationModels': models,
    './requestAuth': { authenticatedUserId: () => null },
    './aiUsageLedger': {
      accumulateMeteredUsage() {},
      buildMeteredSessionKey: (w, u, s) => `${w}:${u}:${s}`,
      checkMeteredZeroBalanceGuard: async () => ({ allowed: true, balance: user1Balance, required: 1 }),
      currentUsageRequestId: () => 'req-anon',
      getRememberedSessionConversationProfile: () => null,
      PIXEL_USD: 0.005,
      recordPixelCharge() {},
      recordProviderUsage() {},
      recordUsageEvent() {},
      recordUsagePixelBalance() {},
      settleMeteredSession: async () => null,
      verifyConversationSessionOwnership: () => true,
    },
  });

  const reqAnonPaid = {
    headers: { 'x-clikb-billing-policy': models.CONVERSATION_PROFILE_POLICY_VERSION },
    body: { text: 'Hello world', conversationModel: 'terra' },
  };
  let statusSent = 200;
  let bodySent = null;
  const resAnonPaid = {
    headersSent: false,
    setHeader() {},
    status(c) { statusSent = c; return this; },
    json(b) { bodySent = b; return this; },
    send(b) { bodySent = b; return this; },
  };
  await voiceTts.voiceTtsStreamRoute(reqAnonPaid, resAnonPaid);
  assert.equal(statusSent, 401);
  assert.equal(user1Balance, 500);
  assert.match(String(bodySent?.message || ''), /sign in/i);
});

test('F02 & F03: concurrent Three.js 10-second tick and finalization race charges floor(6.4)=6 P once and carries 0.4 P into subsequent builds', async () => {
  const harness = require('./helpers/meteredSqlHarness.cjs').createMeteredSqlHarness([['77', 20]]);
  const env = harness.makeEnv();
  let securityGuardFn = null;
  const recordedCharges = [];
  const validPlan = {
    version: 1,
    duration: 5,
    background: '#111111',
    objects: [
      {
        id: 'actor',
        shape: 'box',
        color: '#ffffff',
        keys: [
          { t: 0, position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          { t: 5, position: [1, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        ],
      },
    ],
    camera: [
      { t: 0, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 },
      { t: 5, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 },
    ],
  };

  let rawSegmentPixels = 6.4;
  let resolveStreamHold;
  let streamHold = new Promise((r) => { resolveStreamHold = r; });

  const liveBuilds = loadTsModule('server/src/liveSceneBuilds.ts', {
    './execQuery': env.execQuery,
    './db': env.db,
    './requestAuth': { authenticatedUserId: () => '77' },
    './aiUsageLedger': {
      recordPixelCharge: (p) => recordedCharges.push(p),
      providerUsageCursor: () => 0,
      providerPixelsSince: () => rawSegmentPixels,
    },
    './liveBuildSecurity': {
      guardLiveBuild: (checkFn) => {
        securityGuardFn = checkFn;
        return () => {};
      },
    },
    './liveSceneModelClient': {
      createLiveSceneModelClient: () => ({}),
      LIVE_SCENE_REQUEST_TIMEOUT_MS: 600000,
    },
    './textGeneration': {
      streamRoutedChatText: async function* () {
        yield { type: 'meta', model: 'gpt-6.1-terra', provider: 'openai', liveStreaming: true };
        await streamHold;
        yield { type: 'done', text: JSON.stringify(validPlan), usage: {}, model: 'gpt-6.1-terra', provider: 'openai', liveStreaming: true };
      },
    },
  });

  liveBuilds.registerLivePreparer('motion', async () => ({
    kind: 'motion',
    operation: 'build',
    price: 1,
    atCostPricing: true,
    tier: 'terra',
    planPath: [],
    duration: 5,
    request: { model: 'gpt-6.1-terra', messages: [{ role: 'system', content: 'sys' }] },
    finalize: async (raw) => ({ plan: raw }),
    charge: async () => ({}),
    recordUsage: () => {},
  }));

  const makeRes = () => {
    const closeHandlers = [];
    return {
      destroyed: false,
      status() { return this; },
      setHeader() {},
      flushHeaders() {},
      write() {},
      end() { for (const fn of closeHandlers) fn(); },
      on(evt, fn) { if (evt === 'close') closeHandlers.push(fn); },
    };
  };

  await liveBuilds.handleLiveRequest({ body: { live: true, liveTargetKey: 'shot-race-1' } }, makeRes(), 'motion', '77');
  const session1 = [...liveBuilds.__liveSessionsForTest.values()][0];
  session1.rawProviderPixels = 6.4;
  rawSegmentPixels = 0;

  // Trigger 10s tick and stream completion concurrently (race probe)
  const tickPromise = securityGuardFn();
  resolveStreamHold();
  await Promise.all([tickPromise, session1.running]);

  assert.deepEqual(recordedCharges, [6]);
  assert.equal(harness.state.members.get('77'), 14);

  // Second build for user 77 uses 0.7 P raw: 0.4 P carry + 0.7 P = 1.1 P -> charges 1 P
  streamHold = Promise.resolve();
  rawSegmentPixels = 0.7;
  await liveBuilds.handleLiveRequest({ body: { live: true, liveTargetKey: 'shot-race-2' } }, makeRes(), 'motion', '77');
  const session2 = [...liveBuilds.__liveSessionsForTest.values()].find((s) => s.targetKey === 'shot-race-2');
  if (session2) await session2.running;
  assert.deepEqual(recordedCharges, [6, 1]);
  assert.equal(harness.state.members.get('77'), 13);
});

test('F04 & F05: SQL durability survives process restart, deduplicates eventIds across restarts, prevents cross-user idempotency collisions, and never performs unreceipted debit on DB failure', async () => {
  const { state: sqlState, makeEnv: makeSqlEnv } = require('./helpers/meteredSqlHarness.cjs').createMeteredSqlHarness([['101',10],['202',10]]);

  const env1 = makeSqlEnv();
  const billing1 = loadTsModule('server/src/meteredUsageBilling.ts', {
    './execQuery': env1.execQuery,
    './db': env1.db,
    './aiUsageLedger': { recordPixelCharge() {}, recordUsagePixelBalance() {} },
  });

  const sessionA = billing1.buildMeteredSessionKey('concierge', '101', 'sess-restart');
  await billing1.accumulateMeteredUsage({
    sessionKey: sessionA,
    userId: '101',
    workload: 'concierge',
    profile: 'terra',
    rawPixels: 1.4,
    eventId: 'ev-restart-1',
  });

  // Simulate DB transaction failure during settlement: must NOT call trySpendPixels or lose carry
  sqlState.failNextTransaction = true;
  const failedReceipt = await billing1.settleMeteredSession({
    sessionKey: sessionA,
    userId: '101',
    workload: 'concierge',
    profile: 'terra',
    idempotencyKey: 'idem-shared-key',
  });
  assert.equal(failedReceipt.pixelsCharged, 0);
  assert.equal(failedReceipt.pendingReconciliation, true);
  assert.equal(sqlState.trySpendCalled, 0);
  assert.equal(sqlState.members.get('101'), 10);

  // Simulate process restart with a completely fresh module & fresh anchor (no in-memory mirror)
  const env2 = makeSqlEnv();
  const billing2 = loadTsModule('server/src/meteredUsageBilling.ts', {
    './execQuery': env2.execQuery,
    './db': env2.db,
    './aiUsageLedger': { recordPixelCharge() {}, recordUsagePixelBalance() {} },
  });

  // Re-sending the same eventId 'ev-restart-1' after restart must be deduplicated by SQL PK
  await billing2.accumulateMeteredUsage({
    sessionKey: sessionA,
    userId: '101',
    workload: 'concierge',
    profile: 'terra',
    rawPixels: 1.4,
    eventId: 'ev-restart-1',
  });

  // Settle after restart: charges 1 P from SQL state and keeps 0.4 P (400,000 subunits) carry
  const settledA = await billing2.settleMeteredSession({
    sessionKey: sessionA,
    userId: '101',
    workload: 'concierge',
    profile: 'terra',
    idempotencyKey: 'idem-shared-key',
  });
  assert.equal(settledA.pixelsCharged, 1);
  assert.equal(settledA.remainingPixels, 9);
  assert.equal(settledA.carrySubunits, 400000000);

  // Another user reusing 'idem-shared-key' must be rejected with IDEMPOTENCY_KEY_COLLISION (409)
  const sessionB = billing2.buildMeteredSessionKey('concierge', '202', 'sess-other');
  await billing2.accumulateMeteredUsage({
    sessionKey: sessionB,
    userId: '202',
    workload: 'concierge',
    profile: 'terra',
    rawPixels: 2.1,
    eventId: 'ev-b-1',
  });
  await assert.rejects(
    () =>
      billing2.settleMeteredSession({
        sessionKey: sessionB,
        userId: '202',
        workload: 'concierge',
        profile: 'terra',
        idempotencyKey: 'idem-shared-key',
        throwOnError: true,
      }),
    (err) => err && err.code === 'IDEMPOTENCY_KEY_COLLISION' && err.status === 409,
  );
});

test('raw HTTP upgrade cookie auth resolves user (live STT integration has separate socket tests)', async () => {
  const auth = loadTsModule('server/src/requestAuth.ts', {
    './jwtUtils': {
      verifyToken: (tok) => {
        if (tok === 'valid-jwt-token') return { id: '7' };
        throw new Error('invalid token');
      },
    },
  });

  const upgradeReq = {
    headers: {
      cookie: 'theme=dark; authToken=s%3Avalid-jwt-token.sig123; other=1',
    },
  };
  assert.equal(auth.authenticatedUserId(upgradeReq), '7');

  const xaiStt = loadTsModule('server/src/XaiStt.ts', {
    './conversationModels': loadTsModule('server/src/conversationModels.ts'),
    './requestAuth': auth,
    './db': { getPixelsForUser: async () => 5 },
    './aiUsageLedger': {
      accumulateMeteredUsage() {},
      buildMeteredSessionKey: (w, u, s) => `${w}:${u}:${s}`,
      checkMeteredZeroBalanceGuard: async () => ({ allowed: true, balance: 5, required: 1 }),
      getRememberedSessionConversationProfile: () => null,
      PIXEL_USD: 0.005,
      recordPixelCharge() {},
      recordProviderUsage() {},
      recordUsageEvent() {},
      recordUsagePixelBalance() {},
      settleMeteredSession: async () => null,
      verifyConversationSessionOwnership: () => true,
    },
  });
  assert.equal(typeof xaiStt.attachXaiSttProxy, 'function');
});

test('F12 & F13: post-debit balance read failure leaves pixels undefined and failed refund preserves pixelsCharged with refundPending', async () => {
  let failBalanceRead = false;
  const llmBilling = loadTsModule('server/src/llmBilling.ts', {
    './db': {
      getPixelsForUser: async () => {
        if (failBalanceRead) throw new Error('db read timeout');
        return 15;
      },
      trySpendPixels: async () => true,
      addPixelsToUser: async () => {},
    },
    './requestAuth': { authenticatedUserId: () => '12' },
    './aiUsageLedger': {
      recordPixelCharge() {},
      recordUsagePixelBalance() {},
      replayUsageOperation() {},
      runUsageOperation: async (_op, work) => work(),
    },
  });

  const req = { body: { llmTier: 'terra' } };
  const res = { status() { return this; }, send() { return this; } };
  const resolved = await llmBilling.beginLlmRequest(req, res, 'gpt-6-luna', { operationCount: 1 });
  failBalanceRead = true;
  const charged = await llmBilling.completeLlmCharge(resolved.charge);
  assert.equal(charged.pixelsCharged, 5);
  assert.equal(charged.pixels, undefined);

  // F13: failed refundOnce in withFixedAiPixelCharge preserves X-ClikB-Pixels-Charged and sets X-ClikB-Refund-Pending: 1
  const ledger = loadTsModule('server/src/aiUsageLedger.ts', {
    './db': {
      getPixelsForUser: async () => 20,
      trySpendPixels: async () => true,
      addPixelsToUser: async () => {
        throw new Error('refund DB write failed');
      },
    },
    './requestAuth': { authenticatedUserId: () => '13' },
  });

  const headers = new Map();
  const fixedReq = { path: '/startPlanVid', method: 'POST', headers: {}, body: {} };
  const fixedRes = {
    statusCode: 200,
    headersSent: false,
    hasHeader(k) { return headers.has(k); },
    setHeader(k, v) { headers.set(k, String(v)); },
    status(c) { this.statusCode = c; return this; },
    json(payload) { this.end(JSON.stringify(payload)); return this; },
    end() { return this; },
    on() {},
  };

  const wrapped = ledger.withFixedAiPixelCharge(async (_rq, rs) => {
    rs.status(500).json({ message: 'Downstream error' });
  }, { pixels: 13, stage: 'video_prompt', actionLabel: 'Video Plan' });

  await new Promise((resolve) => {
    ledger.aiUsageContextMiddleware(fixedReq, fixedRes, async () => {
      await wrapped(fixedReq, fixedRes, () => {});
      setTimeout(resolve, 40);
    });
  });

  assert.equal(headers.get('X-ClikB-Pixels-Charged'), '13');
  assert.equal(headers.get('X-ClikB-Refund-Pending'), '1');
});
