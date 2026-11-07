const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith('.')) return Module.prototype.require.call(mod, name);
    const base = path.resolve(path.dirname(filename), name);
    const target = ['.ts', '.tsx', '.js'].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
    return load(path.relative(root, target || base), mocks, cache);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

function fixture(startingBalance = 10) {
  const balances = new Map([['user', startingBalance], ['other', startingBalance]]);
  const spends = [], refunds = [], cache = new Map();
  const mocks = {
    './db': {
      getPixelsForUser: async user => balances.get(user) || 0,
      trySpendPixels: async (user, pixels) => {
        const current = balances.get(user) || 0;
        if (current < pixels) return false;
        balances.set(user, current - pixels); spends.push({ user, pixels }); return true;
      },
      addPixelsToUser: async (user, pixels) => {
        balances.set(user, (balances.get(user) || 0) + pixels); refunds.push({ user, pixels });
      },
    },
    './requestAuth': {
      authenticatedUserId: req => req.userId || 'user',
      authenticatedOwnerId: req => req.ownerId || req.userId || 'user',
    },
    './conversationMeasurementLedger': { appendConversationMeasurement() {}, CONVERSATION_MEASUREMENT_HEADER: 'x-measurement' },
  };
  const billing = load('server/src/llmBilling.ts', mocks, cache);
  const ledger = load('server/src/aiUsageLedger.ts', mocks, cache);
  const req = userId => ({ path: '/ImageDesignStory', headers: {}, userId: userId || 'user', body: { llmTier: 'sol_medium' } });
  async function request(request, work) {
    const headers = new Map();
    const res = {
      headersSent: false, statusCode: 200,
      hasHeader(name) { return headers.has(name.toLowerCase()); },
      setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
      getHeader(name) { return headers.get(name.toLowerCase()); },
      status(status) { this.statusCode = status; return this; },
      send(body) { this.body = body; this.end(); return this; },
      json(body) { return this.send(body); },
      end() { this.headersSent = true; },
    };
    return new Promise(resolve => ledger.aiUsageContextMiddleware(request, res, () => {
      Promise.resolve().then(() => work(res)).then(value => {
        if (!res.headersSent) res.end();
        resolve({ value, res, headers, summary: read(headers) });
      }).catch(error => {
        res.statusCode = error.status || 500;
        if (!res.headersSent) res.end();
        resolve({ error, res, headers, summary: read(headers) });
      });
    }));
  }
  function read(headers) {
    const value = headers.get('x-clikb-usage-summary');
    return value ? JSON.parse(decodeURIComponent(value)) : null;
  }
  return { billing, ledger, balances, spends, refunds, request, req };
}

const identity = name => ({ operationKey: `run:scene:0:${name}`, fingerprint: 'server-computed-source-hash' });
const base = { ...identity('base'), stage: 'image_prompt', actionLabel: 'Image Prompt' };
const pacer = { ...identity('pacer'), stage: 'image_prompt_pacer', actionLabel: 'Image Prompt Pacer' };

test('separate operations preserve base work and charge when pacing fails, then resume with only the outstanding fee', async () => {
  const f = fixture();
  let baseCalls = 0, pacerCalls = 0, failPacer = true;
  async function prepare(req) {
    return f.request(req, async res => {
      const llm = await f.billing.beginLlmRequest(req, res, 'unused', { operations: [base, pacer] });
      if (!llm) return null;
      const original = await f.billing.runBilledLlmOperation(llm, base, async () => {
        baseCalls++;
        f.ledger.recordOpenAiUsage(llm.model, { usage: { prompt_tokens: 120, completion_tokens: 40 } });
        return 'complete scene prompt';
      });
      const paced = await f.billing.runBilledLlmOperation(llm, pacer, async () => {
        pacerCalls++;
        f.ledger.recordOpenAiUsage(llm.model, { usage: { prompt_tokens: 180, completion_tokens: 50 } });
        if (failPacer) throw new Error('temporary provider failure');
        return { prompt: 'selected starting state', handoff: 'contextual relation to the scene' };
      });
      return { original: original.value, paced: paced.value, llmBilling: f.billing.mergeLlmBilling([original.billing, paced.billing]) };
    });
  }
  const failed = await prepare(f.req());
  assert.equal(failed.error.message, 'temporary provider failure');
  assert.equal(f.balances.get('user'), 5);
  assert.equal(failed.summary.pixelsCharged, 5);
  assert.equal(failed.headers.get('x-clikb-pixels-balance'), '5');
  const originalEntry = failed.summary.entries.find(entry => entry.stage === 'image_prompt');
  const failedPacer = failed.summary.entries.find(entry => entry.stage === 'image_prompt_pacer');
  assert.equal(originalEntry.status, 'succeeded'); assert.equal(originalEntry.pixelsCharged, 5);
  assert.equal(failedPacer.status, 'failed'); assert.equal(failedPacer.pixelsCharged, 0);
  assert.equal(originalEntry.calls.length, 1); assert.equal(originalEntry.calls[0].inputTokens, 120);
  assert.equal(failedPacer.calls.length, 1); assert.equal(failedPacer.calls[0].inputTokens, 180);

  failPacer = false;
  const resumed = await prepare(f.req());
  assert.equal(resumed.error, undefined);
  assert.equal(baseCalls, 1); assert.equal(pacerCalls, 2);
  assert.equal(f.balances.get('user'), 0);
  assert.equal(resumed.value.llmBilling.pixelsCharged, 5);
  assert.equal(resumed.value.llmBilling.pixels, 0);
  assert.equal(resumed.summary.pixelsCharged, 5);
  assert.equal(decodeURIComponent(resumed.headers.get('x-clikb-billing-label')), 'Image Prompt Pacer');
  assert.equal(resumed.headers.get('x-clikb-billing-stage'), 'image_prompt_pacer');
  const replay = resumed.summary.entries.find(entry => entry.stage === 'image_prompt');
  assert.equal(replay.requestId, originalEntry.requestId);
  assert.equal(replay.replayed, true); assert.equal(replay.pixelsCharged, 5);
  assert.equal(resumed.summary.entries.find(entry => entry.stage === 'image_prompt_pacer').pixelsCharged, 5);

  const repeated = await prepare(f.req());
  assert.equal(repeated.error, undefined, 'fully cached response remains available with zero balance');
  assert.equal(baseCalls, 1); assert.equal(pacerCalls, 2);
  assert.equal(repeated.summary.pixelsCharged, 0);
  assert.equal(repeated.value.llmBilling.pixelsCharged, 0);
  assert.equal(repeated.value.llmBilling.pixels, 0);
  assert.ok(repeated.summary.entries.every(entry => entry.replayed));
  assert.equal(f.refunds.length, 1);
  const stableRows = new Map();
  for (const result of [failed, resumed, repeated]) {
    for (const entry of result.summary.entries) stableRows.set(entry.requestId, entry);
  }
  assert.equal([...stableRows.values()].reduce((total, entry) => total + entry.pixelsCharged, 0), 10,
    'historical operation amounts stay intact while replayed stable IDs prevent duplicate ledger totals');
  assert.equal([failed, resumed, repeated].reduce((total, result) => total + result.summary.pixelsCharged, 0), 10,
    'request aggregates count only actual new deductions');
});

test('combined preflight prevents work without both fees and batch-continuation cannot bypass it', async () => {
  const f = fixture(5);
  const req = f.req(); req.body.llmBatchContinuation = true;
  const result = await f.request(req, async res => f.billing.beginLlmRequest(req, res, 'unused', { operations: [base, pacer] }));
  assert.equal(result.res.statusCode, 402); assert.equal(result.res.body.required, 10);
  assert.equal(result.value, null); assert.equal(f.spends.length, 0);
  const legacy = await f.billing.beginLlmRequest(req, {}, 'unused');
  assert.equal(legacy.charge, null, 'unrelated existing batch behavior remains unchanged');
});

test('operation cache binds authenticated owner, selected tier, and source fingerprint', async () => {
  const f = fixture(30);
  let calls = 0;
  const prepare = (req, operation) => f.request(req, async res => {
    const llm = await f.billing.beginLlmRequest(req, res, 'unused', { operations: [operation] });
    return llm && f.billing.runBilledLlmOperation(llm, operation, async () => ++calls);
  });
  await prepare(f.req(), base);
  await prepare(f.req(), base);
  assert.equal(calls, 1);
  await prepare(f.req('other'), base);
  await prepare(f.req(), { ...base, fingerprint: 'edited-scene-hash' });
  const changedTier = f.req(); changedTier.body.llmTier = 'luna';
  await prepare(changedTier, base);
  assert.equal(calls, 4);
  assert.equal(f.spends.length, 4);
});

test('simultaneous retry coalesces provider work and deduction for the same operation', async () => {
  const f = fixture(20);
  let finish, calls = 0;
  const gate = new Promise(resolve => { finish = resolve; });
  const prepare = () => {
    const req = f.req();
    return f.request(req, async res => {
      const llm = await f.billing.beginLlmRequest(req, res, 'unused', { operations: [base] });
      return f.billing.runBilledLlmOperation(llm, base, async () => { calls++; await gate; return 'one shared result'; });
    });
  };
  const first = prepare(), second = prepare();
  await new Promise(resolve => setImmediate(resolve));
  finish();
  const results = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(f.spends.length, 1); assert.equal(f.balances.get('user'), 15);
  assert.deepEqual(results.map(result => result.value.billing.pixelsCharged).sort(), [0, 5]);
  assert.equal(results[0].summary.entries[0].requestId, results[1].summary.entries[0].requestId);
});

test('atomic reservation stops a model call if another operation spends the balance after preflight', async () => {
  const f = fixture(5);
  let calls = 0;
  const req = f.req();
  const result = await f.request(req, async res => {
    const llm = await f.billing.beginLlmRequest(req, res, 'unused', { operations: [pacer] });
    f.balances.set('user', 0);
    return f.billing.runBilledLlmOperation(llm, pacer, async () => { calls++; return 'not executed'; });
  });
  assert.equal(result.error.status, 402); assert.equal(result.error.required, 5);
  assert.equal(calls, 0); assert.equal(f.spends.length, 0);
});

test('client publishes individual stable operation rows, not the aggregate, and supports old headers', () => {
  const module = load('src/CreationLedgerContext.tsx', { react: { createContext: value => value, useContext: value => value } });
  const row = (requestId, stage, charge) => ({ requestId, stage, actionLabel: stage, pixelsCharged: charge, calls: [] });
  const original = row('base-op', 'image_prompt', 5), paced = row('pacer-op', 'image_prompt_pacer', 5);
  const summary = { ...row('aggregate', 'image_prompt', 10), entries: [original, paced, paced] };
  const headers = { 'x-clikb-usage-summary': encodeURIComponent(JSON.stringify(summary)) };
  const published = [], unsubscribe = module.subscribeToCreationLedger(entry => published.push(entry));
  module.captureCreationLedgerHeader(headers); unsubscribe();
  assert.deepEqual(published.map(entry => entry.requestId), ['base-op', 'pacer-op']);
  assert.equal(published.reduce((total, entry) => total + entry.pixelsCharged, 0), 10);
  const legacy = { get: () => encodeURIComponent(JSON.stringify(original)) };
  assert.deepEqual(module.readCreationLedgerEntries(legacy).map(entry => entry.requestId), ['base-op']);
});
