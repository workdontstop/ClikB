const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const outboxTestRoot = path.join(root, '.tmp', 'metered-outbox-tests');
function outboxTestDirectory() {
  fs.mkdirSync(outboxTestRoot, { recursive: true });
  return fs.mkdtempSync(path.join(outboxTestRoot, 'clikb-usage-outbox-'));
}
function removeOutboxTestDirectory(dir) {
  const absolute = path.resolve(dir);
  assert.ok(absolute.startsWith(path.resolve(outboxTestRoot) + path.sep + 'clikb-usage-outbox-'));
  assert.ok(absolute.startsWith(path.join(root, '.tmp') + path.sep));
  fs.rmSync(absolute, { recursive: true, force: true });
}
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
function expression(file, name, bindings, route = false) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (!route && ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    if (route && ts.isCallExpression(node) && node.expression.getText(source) === 'app.post' && node.arguments[0]?.text === name) found = node.arguments[1];
    ts.forEachChild(node, visit);
  } visit(source); assert.ok(found, name);
  const code = ts.transpileModule(`const callback=${found.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), code + ';return callback;')(...Object.values(bindings));
}
const models = load('server/src/conversationModels.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); } assert.fail('async work did not finish'); }
class Socket extends EventEmitter {
  readyState = 1; sent = []; closed = false;
  send(value) { this.sent.push(value); }
  close() { if (!this.closed) { this.closed = true; this.readyState = 3; this.emit('close'); } }
  events() { return this.sent.filter(v => !Buffer.isBuffer(v)).map(v => JSON.parse(v)); }
}
function voiceFixture(overrides = {}) {
  const accepted = [], settlements = [], measurement = [];
  let remembered = null;
  const ledger = {
    PIXEL_USD: 1 / 333, METERED_SETTLEMENT_INTERVAL_MS: 10000,
    accumulateMeteredUsage: async event => { accepted.push(event); },
    buildMeteredSessionKey: (workload, user, session) => `${workload}:${user}:${session}`,
    checkMeteredZeroBalanceGuard: async () => ({ allowed: true, balance: 20, required: 1 }),
    getRememberedSessionConversationProfile: () => remembered,
    rememberSessionConversationProfile: (_session, tier) => { remembered = tier; },
    verifyConversationSessionOwnership: () => true,
    settleMeteredSession: async event => { settlements.push(event); return null; },
    usdToSubunits: amount => Math.round(amount * 333 * 1e9),
    currentUsageRequestId: () => 'tts-immutable-request', recordPixelCharge() {}, recordProviderUsage() {},
    recordUsageEvent() {}, recordUsagePixelBalance() {}, ...overrides,
  };
  const mocks = { './aiUsageLedger': ledger, './requestAuth': { authenticatedUserId: () => '7' },
    './conversationModels': models, './GeminiLive': { LIVE_STT_MODEL: 'gemini-3.1-flash-live-preview' },
    './conversationMeasurementLedger': { appendConversationMeasurement: event => measurement.push(event) },
    dotenv: { config() {} },
  };
  return { ledger, mocks, accepted, settlements, measurement };
}

test('actual video endpoints coalesce exact retries but invalidate changed PlanVid and scene operation identity', async () => {
  for (const route of ['GptVideoVisualMiniMax', 'GptVideoVisual']) {
    let balance = 30, providerCalls = 0, sequence = 0;
    const billing = load('server/src/llmBilling.ts', {
      './db': { getPixelsForUser: async () => balance, trySpendPixels: async (_u, p) => { balance -= p; return true; }, addPixelsToUser: async (_u, p) => { balance += p; } },
      './requestAuth': { authenticatedUserId: () => '7' },
      './aiUsageLedger': { recordPixelCharge() {}, recordUsagePixelBalance() {}, replayUsageOperation() {},
        runUsageOperation: async (_operation, work, options) => { const value = await work(); options.onComplete({ requestId: `op-${++sequence}`, calls: [] }); return value; } },
    });
    const callback = expression('server/src/GptApi.ts', route, {
      ...require('./promptTestBindings.cjs'), ...load('server/src/cinemaNarrationDialogue.ts'),
      ...load('server/src/videoCreationContext.ts'), ...billing,
      logIntentBlueprintUsage() {}, buildVideoSkillBlock: () => '', VIDEO_AUTO_PROMPT_MODEL: 'gpt-6-luna',
      getModelDirective: () => 'CAMERA:\nMOTION:\nAUDIO:\nCONSTRAINTS:\nMusic: none',
      generateGPT4oPrompt5B: async () => `CAMERA:\nMotion result ${++providerCalls}`, console: { log() {}, error() {} },
    });
    const body = { promptOperationId: 'scene:0:logical-operation', llmTier: 'luna', question: 'Pilot flies',
      imageDescription: '@Pilot at the controls', PlanVid: { characters: [{ name: '@Pilot', description: 'Red suit' }] },
      duration: 5, targetModel: 'WAN', creationType: 0, suppressDialogue: true };
    async function run(extra) { let output; const response = { status(code) { assert.fail('unexpected status ' + code); }, send(value) { output = value; return this; } }; await callback({ body: { ...body, ...extra } }, response); return output; }
    await run(); const retry = await run();
    assert.equal(providerCalls, 1); assert.equal(retry.llmBilling.replayed, true); assert.equal(balance, 29);
    const changed = await run({ PlanVid: { characters: [{ name: '@Pilot', description: 'Blue suit' }] } });
    assert.equal(providerCalls, 2); assert.equal(changed.llmBilling.pixelsCharged, 1);
    await run({ promptOperationId: 'scene:1:separate-operation' });
    assert.equal(providerCalls, 3); assert.equal(balance, 27);
  }
});

test('actual VideoDesign endpoint invalidates cached Cinema speech changes', async () => {
  const fingerprints = [], outputs = [];
  const callback = expression('server/src/GptApi.ts', 'GptVideoVisual', {
    ...require('./promptTestBindings.cjs'), ...load('server/src/cinemaNarrationDialogue.ts'), ...load('server/src/videoCreationContext.ts'),
    logIntentBlueprintUsage() {}, buildVideoSkillBlock: () => '', VIDEO_AUTO_PROMPT_MODEL: 'gpt-6-luna', getModelDirective: () => '',
    beginLlmRequest: async (_req, _res, _fallback, options) => { fingerprints.push(options.operations[0].fingerprint); return { model: 'gpt-6-luna' }; },
    runBilledLlmOperation: async (_llm, _op, work) => ({ value: await work(), billing: null }),
    generateGPT4oPrompt5B: async () => 'CAMERA:\nSlow push in.\n\nAUDIO:\nGentle wind.', console: { log() {}, error() {} },
  });
  const body = { question: 'We are ready', imageDescription: '@Pilot checks engine', PlanVid: { characters: [{ name: '@Pilot' }] },
    duration: 5, creationType: 1, cinemaNarration: { stage: 'A', text: 'We are ready', delivery: 'Calm', stages: [
      { stage: 'A', imageDescription: '@Pilot checks engine', context: 'Preparation', duration: 5 },
      { stage: 'B', imageDescription: '@Pilot starts engine', context: 'Departure', duration: 5 }] } };
  for (const line of ['Ready to fly.', 'Wait for me.']) await callback({ body: { ...body, cinemaDialoguePlan: { stageA: `@Pilot (calm): says "${line}"`, stageB: '@Pilot (calm): says "Let us go."' } } },
    { status(code) { assert.fail(String(code)); }, send(value) { outputs.push(value); } });
  assert.notEqual(fingerprints[0], fingerprints[1]);
  assert.match(outputs[0].storyPrompt, /Ready to fly/); assert.match(outputs[1].storyPrompt, /Wait for me/);
});

test('browser-direct voice reports are telemetry only even for unversioned paid tier and forged duration', async () => {
  const measurements = []; let ownerChecks = 0;
  const callback = expression('server/src/server.ts', '/conversation-measurement/client-record', {
    authenticatedUserId: () => '7', verifyConversationSessionOwnership: () => { ownerChecks++; return true; },
    appendConversationMeasurement: event => measurements.push(event),
    accumulateMeteredUsage: () => assert.fail('client estimates must never accrue wallet usage'),
    settleMeteredSession: () => assert.fail('client telemetry must never debit'),
  }, true);
  let response;
  await callback({ headers: { 'x-clikb-conversation-session': 'session-7' }, body: { durationSeconds: 86400, conversationModel: 'sol' } },
    { status() { return this; }, json(value) { response = value; } });
  assert.equal(ownerChecks, 1); assert.equal(response.telemetryOnly, true); assert.equal(response.meteredBilling, null);
  assert.equal(measurements[0].calls[0].metadata.billableToUser, false);
});

test('receipt feed shares an account scope across measurement resets and returns paid receipts after switching free', async () => {
  const keys = [], reads = [];
  const callback = expression('server/src/server.ts', '/concierge/metered-settle', {
    authenticatedUserId: () => '7', verifyConversationSessionOwnership: () => true,
    getRememberedSessionConversationProfile: () => 'luna', ...models,
    buildMeteredSessionKey: (workload, user, scope) => { keys.push([workload, user, scope]); return `${workload}:${user}:${scope}`; },
    settleMeteredSession: () => assert.fail('free profile cannot start a new debit'),
    readMeteredSessionReceipts: async request => { reads.push(request); return [{ receiptSeq: 6, pixelsCharged: 3, workload: 'voice', userId: '7', sessionKey: request.sessionKey }]; },
  }, true);
  for (const sessionId of ['before-reset', 'after-reset']) {
    let response;
    await callback({ headers: { 'x-clikb-conversation-session': sessionId }, body: { afterReceiptSeq: 5 } },
      { status(code) { assert.fail(String(code)); }, json(value) { response = value; } });
    assert.equal(response.sessionKey, 'concierge:7:account'); assert.equal(response.receipts[0].pixelsCharged, 3);
    assert.equal(response.latestReceiptSeq, 6); assert.equal(response.freeTier, true);
  }
  assert.deepEqual(keys, [['concierge', '7', 'account'], ['concierge', '7', 'account']]);
  assert.ok(reads.every(request => request.afterReceiptSeq === 5));
});

test('actual browser connector uses Gemini server proxy for free voice and sends paid tier before the next PCM frame', async () => {
  let tier = 'luna'; const sockets = [], transcriptions = [];
  class BrowserSocket {
    static OPEN = 1;
    readyState = 0; sent = [];
    constructor(url) { this.url = url; sockets.push(this); setImmediate(() => { this.readyState = 1; this.onopen(); }); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; }
  }
  const connector = expression('src/hooks/useGeminiVoice.ts', 'connectXaiStt', {
    clikUrl: 'https://api.example.test', XAI_STT_WS_PATH: '/xaiSttStream', GEMINI_STT_WS_PATH: '/geminiSttStream',
    getConversationMeasurementSessionId: () => 'test-session', CONVERSATION_PROFILE_POLICY_VERSION: models.CONVERSATION_PROFILE_POLICY_VERSION,
    store: { getState: () => ({ settings: { conversationModel: tier } }) }, WebSocket: BrowserSocket,
    base64ToBytes: value => new Uint8Array(Buffer.from(value, 'base64')),
    L() {}, sttSessionIdRef: { current: 1 }, sttRecoveringRef: { current: false }, reconnectStableTimerRef: { current: null },
    activeRef: { current: true }, closedRef: { current: false }, sttReconnectAttemptsRef: { current: 0 },
    sttSetupCompleteRef: { current: true }, window: { setTimeout: () => 1, clearTimeout() {} }, STT_RECONNECT_STABLE_MS: 8000,
    setError() {}, setStatus() {}, handleSttMessage: message => transcriptions.push(message), handleXaiSttEvent() {}, scheduleSttReconnect() {},
  });
  const adapter = await connector(1, 'gemini');
  assert.match(sockets[0].url, /^wss:\/\/api\.example\.test\/geminiSttStream/);
  assert.match(sockets[0].url, /conversationModel=luna/);
  adapter.sendRealtimeInput({ audio: { data: 'AAAA' } }); tier = 'terra'; adapter.sendRealtimeInput({ audio: { data: 'AAAA' } });
  assert.equal(sockets[0].sent.length, 3); assert.equal(JSON.parse(sockets[0].sent[1]).conversationModel, 'terra');
  assert.ok(sockets[0].sent[2] instanceof ArrayBuffer);
  sockets[0].onmessage({ data: JSON.stringify({ type: 'gemini_message', message: { serverContent: { inputTranscription: { text: 'Hello' } } } }) });
  assert.equal(transcriptions[0].serverContent.inputTranscription.text, 'Hello');
  const source = fs.readFileSync(path.join(root, 'src/hooks/useGeminiVoice.ts'), 'utf8');
  assert.doesNotMatch(source, /new GoogleGenAI|\.live\.connect\(/, 'there is no remaining direct browser Gemini transport to bypass tier switching');
});

test('xAI paid switch holds audio behind the asynchronous balance guard and stops at zero', async () => {
  let release, checked = false;
  const hold = new Promise(resolve => { release = resolve; });
  const fixture = voiceFixture({ checkMeteredZeroBalanceGuard: async () => { checked = true; await hold; return { allowed: false, balance: 0, required: 1 }; } });
  const xai = load('server/src/XaiStt.ts', fixture.mocks), client = new Socket(), upstream = new Socket();
  xai.proxyToXai(client, '/xaiSttStream?measurementSessionId=test&conversationModel=luna', '7', { upstreamFactory: () => upstream });
  upstream.emit('message', Buffer.from('{"type":"transcript.created"}'), false);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'clikb.tier', conversationModel: 'terra', billingPolicyVersion: models.CONVERSATION_PROFILE_POLICY_VERSION })), false);
  client.emit('message', Buffer.alloc(32000), true);
  await until(() => checked); assert.equal(upstream.sent.length, 0);
  release(); await until(() => client.closed);
  assert.equal(upstream.sent.length, 0); assert.equal(fixture.accepted.length, 0);
  assert.ok(client.events().some(event => event.exhausted));
});

test('xAI meters server-forwarded paid slices only across free-paid-free switches', async () => {
  const fixture = voiceFixture(), xai = load('server/src/XaiStt.ts', fixture.mocks), client = new Socket(), upstream = new Socket();
  xai.proxyToXai(client, '/xaiSttStream?measurementSessionId=test&conversationModel=luna', '7', { upstreamFactory: () => upstream });
  upstream.emit('message', Buffer.from('{"type":"transcript.created"}'), false);
  client.emit('message', Buffer.alloc(32000), true);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'clikb.tier', conversationModel: 'terra', billingPolicyVersion: models.CONVERSATION_PROFILE_POLICY_VERSION })), false);
  client.emit('message', Buffer.alloc(64000), true);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'clikb.tier', conversationModel: 'luna' })), false);
  client.emit('message', Buffer.alloc(32000), true);
  await until(() => upstream.sent.length === 3); client.close(); await tick();
  assert.equal(fixture.accepted.length, 1); assert.equal(fixture.accepted[0].tier, 'terra');
  assert.equal(fixture.accepted[0].costSubunits, fixture.ledger.usdToSubunits(2 / 3600 * .20));
});

test('Gemini server proxy preserves free fallback and measures paid usage from provider metadata only', async () => {
  const fixture = voiceFixture(), gemini = load('server/src/GeminiStt.ts', fixture.mocks), client = new Socket(), connections = [];
  gemini.proxyToGemini(client, '/geminiSttStream?measurementSessionId=test&conversationModel=luna', '7', {
    connect: async config => { const transport = { frames: [], sendRealtimeInput(value) { this.frames.push(value); }, close() {} }; connections.push({ config, transport }); return transport; },
  });
  await until(() => connections.length === 1);
  client.emit('message', Buffer.alloc(32000), true); await until(() => connections[0].transport.frames.length === 1);
  const usage = { promptTokenCount: 1000, responseTokenCount: 0, promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 1000 }], responseTokensDetails: [] };
  connections[0].config.callbacks.onmessage({ usageMetadata: usage, serverContent: { inputTranscription: { text: 'Hello' } } });
  assert.equal(fixture.accepted.length, 0);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'clikb.tier', conversationModel: 'terra', billingPolicyVersion: models.CONVERSATION_PROFILE_POLICY_VERSION })), false);
  client.emit('message', Buffer.alloc(32000), true); await until(() => connections.length === 2 && connections[1].transport.frames.length === 1);
  connections[1].config.callbacks.onmessage({ usageMetadata: usage }); await until(() => fixture.accepted.length === 1);
  assert.equal(fixture.accepted[0].profile, 'terra'); assert.equal(fixture.accepted[0].providerCostUsd, .003);
  connections[1].config.callbacks.onmessage({ usageMetadata: usage }); await tick(); assert.equal(fixture.accepted.length, 1);
  connections[1].config.callbacks.onmessage({ usageMetadata: { promptTokenCount: 9000, responseTokenCount: 1 } });
  await tick(); assert.equal(fixture.accepted.length, 1); assert.ok(client.events().some(event => event.pendingReconciliation));
  client.close(); await tick();
});

test('Gemini paid switch cannot forward audio while balance admission is pending', async () => {
  let release, checked = false; const hold = new Promise(resolve => { release = resolve; });
  const fixture = voiceFixture({ checkMeteredZeroBalanceGuard: async () => { checked = true; await hold; return { allowed: false, balance: 0 }; } });
  const gemini = load('server/src/GeminiStt.ts', fixture.mocks), client = new Socket(), frames = [];
  gemini.proxyToGemini(client, '/geminiSttStream?measurementSessionId=test&conversationModel=luna', '7', {
    connect: async () => ({ sendRealtimeInput: value => { if (value.audio) frames.push(value); }, close() {} }),
  });
  await tick(); client.emit('message', Buffer.from(JSON.stringify({ type: 'clikb.tier', conversationModel: 'terra', billingPolicyVersion: models.CONVERSATION_PROFILE_POLICY_VERSION })), false);
  client.emit('message', Buffer.alloc(32000), true); await until(() => checked); assert.equal(frames.length, 0);
  release(); await until(() => client.closed); assert.equal(frames.length, 0);
});

test('paid TTS awaits reported usage acceptance; missing usage stays telemetry only', async () => {
  const originalKey = process.env.GOOGLE_LIVE_KEY; process.env.GOOGLE_LIVE_KEY = 'isolated-test-key';
  try {
    for (const reported of [false, true]) {
      const fixture = voiceFixture(); let release, persistenceStarted = false;
      const hold = new Promise(resolve => { release = resolve; });
      fixture.ledger.accumulateMeteredUsage = async event => { persistenceStarted = true; await hold; fixture.accepted.push(event); };
      const tts = load('server/src/VoiceTts.ts', { ...fixture.mocks, '@google/genai': { Modality: { AUDIO: 'AUDIO' }, GoogleGenAI: class {
        models = { generateContentStream: async function* () { yield { candidates: [{ content: { parts: [{ inlineData: { data: Buffer.alloc(48000).toString('base64') } }] } }],
          ...(reported ? { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 25 } } : {}) }; } };
      } } });
      const res = new Socket(); res.headersSent = false; res.writableEnded = false;
      res.setHeader = () => {}; res.status = code => { assert.fail('unexpected HTTP ' + code); };
      res.write = () => { res.headersSent = true; }; res.end = () => { res.writableEnded = true; res.emit('close'); };
      const running = tts.voiceTtsStreamRoute({ headers: { 'x-clikb-billing-policy': models.CONVERSATION_PROFILE_POLICY_VERSION }, body: { text: 'Hello', conversationModel: 'terra' } }, res);
      if (reported) { await until(() => persistenceStarted); assert.equal(fixture.settlements.length, 0); assert.equal(res.writableEnded, false); }
      release(); await running;
      assert.equal(fixture.accepted.length, reported ? 1 : 0); assert.equal(fixture.settlements.length, reported ? 1 : 0);
      assert.equal(res.writableEnded, true);
    }
  } finally { if (originalKey === undefined) delete process.env.GOOGLE_LIVE_KEY; else process.env.GOOGLE_LIVE_KEY = originalKey; }
});

test('durable usage outbox survives restart, serializes concurrent retries and strips request data', async () => {
  const dir = outboxTestDirectory();
  let accept = false, accepted = 0, settlements = 0;
  const core = { configureMeteredUsageFailureHandler() {}, accumulateMeteredUsage: async () => { if (!accept) throw new Error('DB offline'); accepted++; }, settleMeteredSession: async () => { settlements++; return null; } };
  const outboxModule = load('server/src/meteredUsageOutbox.ts', { './meteredUsageBilling': core });
  const event = { eventId: 'immutable-1', userId: '7', sessionKey: 'voice:7:s1', workload: 'voice', profile: 'terra', model: 'gemini-3.1-flash-live-preview', providerCostUsd: .03,
    prompt: 'PRIVATE MUST NEVER BE SAVED', audio: 'PRIVATE PCM', queryRunner: { secret: 'NO' } };
  try {
    const first = outboxModule.createMeteredUsageOutbox({ directory: dir }); await first.save(event, new Error('DB offline'));
    const filenames = fs.readdirSync(dir); assert.equal(filenames.length, 1);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, filenames[0]), 'utf8'), /PRIVATE|queryRunner|secret/);
    await first.drain(); assert.equal(fs.readdirSync(dir).length, 1);
    accept = true; const restarted = outboxModule.createMeteredUsageOutbox({ directory: dir });
    await Promise.all([restarted.drain(), restarted.drain()]);
    assert.equal(accepted, 1); assert.equal(settlements, 1); assert.equal(fs.readdirSync(dir).length, 0);
    await restarted.save(event, Object.assign(new Error('wrong owner'), { status: 403 })); assert.equal(fs.readdirSync(dir).length, 0);
  } finally {
    removeOutboxTestDirectory(dir);
  }
});

test('settlement-only outbox recovers accepted usage without inventing or re-accumulating a provider event', async () => {
  const dir = outboxTestDirectory();
  let pending = true, settlements = 0;
  const core = { configureMeteredUsageFailureHandler() {}, configureMeteredSettlementFailureHandler() {},
    accumulateMeteredUsage: async () => assert.fail('accepted usage must not be accumulated again'),
    settleMeteredSession: async () => { settlements++; return pending ? { pendingReconciliation: true } : { pixelsCharged: 3 }; } };
  const { createMeteredUsageOutbox } = load('server/src/meteredUsageOutbox.ts', { './meteredUsageBilling': core });
  try {
    const first = createMeteredUsageOutbox({ directory: dir });
    await first.saveSettlement({ userId: '7', sessionKey: 'concierge:7:account', workload: 'voice', profile: 'terra', model: 'gemini', queryRunner: { private: 'MUST_NOT_PERSIST' } }, new Error('debit transaction offline'));
    const record = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'));
    assert.equal(record.kind, 'settlement'); assert.equal(record.increment, undefined); assert.equal(record.params.queryRunner, undefined);
    await first.drain(); assert.equal(fs.readdirSync(dir).length, 1);
    pending = false; await createMeteredUsageOutbox({ directory: dir }).drain();
    assert.equal(settlements, 2); assert.equal(fs.readdirSync(dir).length, 0);
  } finally {
    removeOutboxTestDirectory(dir);
  }
});

test('bounded outbox retries rotate past blocked files and quarantine terminal ownership errors', async () => {
  const dir = outboxTestDirectory(); let healthyId = '', accepted = 0;
  const core = { configureMeteredUsageFailureHandler() {}, configureMeteredSettlementFailureHandler() {},
    accumulateMeteredUsage: async event => {
      if (event.eventId === 'rejected-owner') throw Object.assign(new Error('wrong owner'), { status: 403 });
      if (event.eventId !== healthyId) throw Object.assign(new Error('temporary database failure'), { status: 503 });
      accepted++;
    }, settleMeteredSession: async () => null };
  const { createMeteredUsageOutbox } = load('server/src/meteredUsageOutbox.ts', { './meteredUsageBilling': core });
  try {
    const outbox = createMeteredUsageOutbox({ directory: dir, batchSize: 25 });
    const event = { userId: '7', sessionKey: 'concierge:7:account', workload: 'voice', profile: 'terra', providerCostUsd: .01 };
    for (let i = 0; i < 26; i++) await outbox.save({ ...event, eventId: `usage-${i}` }, new Error('offline'));
    const ordered = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort();
    healthyId = JSON.parse(fs.readFileSync(path.join(dir, ordered[25]), 'utf8')).increment.eventId;
    await outbox.drain(); assert.equal(accepted, 0);
    await outbox.drain(); assert.equal(accepted, 1, 'healthy item behind a failed batch must not starve');
    await outbox.save({ ...event, eventId: 'rejected-owner' }, new Error('previously transient'));
    for (let i = 0; i < 3; i++) await outbox.drain();
    assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.rejected')).length, 1);
    assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.json')).length, 25, 'transient failures remain retryable');
  } finally { removeOutboxTestDirectory(dir); }
});
