const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { createMeteredSqlHarness: createSqlStore } = require('./helpers/meteredSqlHarness.cjs');
const createMeteredSqlHarness = balance => {
    const store = createSqlStore([['1', balance]]);
    return { ...store, get data() { return store.state; },
        get debits() { return [...store.state.receipts.values()].map(row => row.pixels_charged).filter(value => value > 0); },
        failOnce(predicate) { store.state.failQuery = async statement => {
            if (predicate(statement)) { store.state.failQuery = null; throw new Error('injected SQL failure'); }
        }; },
    };
};

function load(file, mocks, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    let source = fs.readFileSync(filename, 'utf8');
    if (file === 'server/src/liveSceneBuilds.ts') source += '\nexport const testInternals = { settleLiveBuildAccounting, completeAndCharge, secureSession, persist, acquireProviderLease, renewProviderLease, releaseProviderLease };';
    mod._compile(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return mod.exports;
}

const fixture = (duration = 2) => ({ version: 1, duration, background: '#202838', objects: [{
    id: 'subject', shape: 'box', color: '#eeeeee', keys: [0, duration].map(t => ({ t, position: [t, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })),
}], camera: [0, duration].map(t => ({ t, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 })) });

function worker(sql, rawPixels = 0.6, output = fixture(), stream) {
    const charged = [];
    let verify, providerCalls = 0;
    const env = sql.makeEnv();
    // A fresh function/cache per worker prevents accidental Symbol/mirror sharing.
    const db = env.db;
    const mocks = {
        './execQuery': env.execQuery, './db': db,
        './requestAuth': { authenticatedUserId: () => '1' },
        './jwtUtils': { verifyToken: () => ({ id: '1' }) },
        './liveBuildSecurity': { guardLiveBuild: (check, _heartbeat, halt) => {
            verify = async () => { try { return await check(); } catch (error) { halt(error); throw error; } };
            return () => {};
        } },
        './liveSceneModelClient': { createLiveSceneModelClient: () => { if (stream) return {}; throw new Error('No provider calls in accounting tests'); }, LIVE_SCENE_REQUEST_TIMEOUT_MS: 600000 },
        './aiUsageLedger': { recordPixelCharge: n => charged.push(n), recordUsagePixelBalance() {}, recordOpenAiUsage() {}, providerUsageCursor: () => 0, providerPixelsSince: () => rawPixels },
        './textGeneration': { streamRoutedChatText: stream || (() => { throw new Error('No provider calls in accounting tests'); }), createRoutedTextClient: client => client, resetOpenAiAvailability() {} },
        openai: class { chat = { completions: { create: async () => { providerCalls++; return { choices: [{ message: { content: JSON.stringify(output) } }] }; } } }; },
    };
    const cache = new Map();
    const routes = load('server/src/liveSceneBuilds.ts', mocks, cache);
    return { live: routes.testInternals, routes,
        engine: load('server/src/meteredUsageBilling.ts', mocks, cache), charged, get verify() { return verify; }, get providerCalls() { return providerCalls; },
        motion: () => load('server/src/MotionGuideRoute.ts', mocks, cache),
        spatial: () => load('server/src/SpatialWorldPlanRoute.ts', mocks, cache),
    };
}

const spec = { atCostPricing: true, tier: 'luna', price: 1 };
function build(sql, id, rawPixels, scope = 'same-project') {
    const session = { buildId: id, userId: '1', kind: 'motion', operation: 'motion-build', targetKey: id, tier: 'luna',
        body: { billingSessionId: scope }, status: 'streaming', events: [], seq: 0, commitSeq: 1, listeners: new Set(),
        pinned: [], segments: 1, charged: false, startedAt: Date.now(), lastPersist: 0, rawProviderPixels: rawPixels,
        settledWholePixels: 0, accruedSubunits: 0, accepted: fixture(),
    };
    sql.data.builds.set(id, { build_id: id, user_id: '1', kind: 'motion', operation: 'motion-build', target_key: id,
        tier: 'luna', status: 'streaming', request_body: JSON.stringify(session.body),
        checkpoint: JSON.stringify({ rawProviderPixels: rawPixels, settledWholePixels: 0, accruedSubunits: 0, accepted: session.accepted }), charged: 0, segments: 1,
    });
    return session;
}
const checkpoint = (sql, id) => JSON.parse(sql.data.builds.get(id).checkpoint);

test('Three.js tick rollback restores wallet, event, receipt, build and memory; restart retries once', async () => {
    const sql = createMeteredSqlHarness(20), first = worker(sql), session = build(sql, 'rollback-build', 6.4);
    sql.failOnce(statement => statement.startsWith('UPDATE scene_live_builds SET checkpoint='));
    await assert.rejects(first.live.settleLiveBuildAccounting(session, spec), /injected SQL failure/);
    assert.equal(sql.data.members.get('1'), 20);
    assert.equal(sql.data.events.size, 0); assert.equal(sql.data.receipts.size, 0);
    assert.equal(session.settledWholePixels, 0); assert.equal(session.accruedSubunits, 0);
    assert.equal(checkpoint(sql, session.buildId).settledWholePixels, 0);
    assert.equal(first.engine.getMeteredSessionSnapshot('motion:1:same-project'), null);

    const restarted = worker(sql), restored = { ...session, events: [], listeners: new Set() };
    const committed = await restarted.live.settleLiveBuildAccounting(restored, spec);
    assert.equal(committed.deltaChargePixels, 6); assert.equal(committed.receipt.carrySubunits, 400000000);
    assert.equal(sql.data.members.get('1'), 14); assert.equal(sql.data.events.size, 1);
    assert.equal(checkpoint(sql, restored.buildId).accruedSubunits, 6400000000);
    // The stale first worker can finalize, but cannot debit this accepted usage again.
    await first.live.completeAndCharge(session, spec, { plan: fixture() });
    assert.equal(session.final.llmBilling.pixelsCharged, 6);
    assert.equal(session.final.llmBilling.deltaPixelsCharged, 0);
    assert.equal(session.final.llmBilling.pixels, 14);
    assert.deepEqual(sql.debits, [6]); assert.deepEqual(first.charged, []);
});

test('independent workers racing a tick and finalization charge once; stale checkpoint cannot erase accounting', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), b = worker(sql);
    const sessionA = build(sql, 'race-build', 6.4), sessionB = { ...sessionA, listeners: new Set(), events: [] };
    await Promise.all([
        a.live.settleLiveBuildAccounting(sessionA, spec),
        b.live.completeAndCharge(sessionB, spec, { plan: fixture() }),
    ]);
    assert.equal(sql.data.members.get('1'), 14); assert.deepEqual(sql.debits, [6]);
    assert.equal(sql.data.events.size, 1);
    const final = JSON.parse(sql.data.builds.get(sessionA.buildId).final_result);
    assert.equal(final.llmBilling.pixelsCharged, 6);
    const stale = { ...sessionA, charged: false, status: 'paused', accruedSubunits: 0, settledWholePixels: 0, rawProviderPixels: 0 };
    await a.live.persist(stale, true);
    assert.equal(sql.data.builds.get(sessionA.buildId).status, 'completed');
    assert.equal(checkpoint(sql, sessionA.buildId).accruedSubunits, 6400000000);
    assert.equal(checkpoint(sql, sessionA.buildId).settledWholePixels, 6);
});

test('carry survives restart and is shared by streamed and buffered Motion Guide builds', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), streamed = build(sql, 'carry-build', 6.4);
    await a.live.completeAndCharge(streamed, spec, { plan: fixture() });
    const restarted = worker(sql, 0.6);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await restarted.motion().buildMotionGuide({ cookies: { authToken: 'fixture' }, body: {
        prompt: 'Move the box', duration: 2, aspectRatio: '16:9', llmTier: 'luna', billingSessionId: 'same-project',
    } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.llmBilling.pixelsCharged, 1); assert.equal(res.body.llmBilling.carrySubunits, 0);
    assert.equal(sql.data.members.get('1'), 13); assert.deepEqual(sql.debits, [6, 1]);
    assert.equal(sql.data.sessions.get('motion:1:same-project').cumulative_subunits, 7000000000);
});

test('buffered Motion Guide concurrent workers use SQL floor/carry rather than direct spend or local counters', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), b = worker(sql);
    const run = async w => {
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await w.motion().buildMotionGuide({ cookies: { authToken: 'fixture' }, body: {
            prompt: 'Move the box', duration: 2, aspectRatio: '16:9', llmTier: 'luna', billingSessionId: 'same-project',
        } }, res);
        assert.equal(res.statusCode, 200, JSON.stringify(res.body)); return res.body.llmBilling;
    };
    const receipts = await Promise.all([run(a), run(b)]);
    assert.equal(receipts.reduce((sum, value) => sum + value.pixelsCharged, 0), 1);
    assert.equal(sql.data.members.get('1'), 19);
    assert.equal(sql.data.sessions.get('motion:1:same-project').carry_subunits, 200000000);
});

test('completion caps its debit at the available balance and retains the finished scene and unpaid usage', async () => {
    const sql = createMeteredSqlHarness(5), a = worker(sql), session = build(sql, 'insufficient-build', 6.4);
    await a.live.completeAndCharge(session, spec, { plan: fixture() });
    assert.equal(sql.data.members.get('1'), 0); assert.equal(sql.data.events.size, 1);
    assert.equal(session.settledWholePixels, 5); assert.equal(session.status, 'completed');
    assert.ok(session.final.plan.objects.length); assert.equal(session.final.llmBilling.pixelsCharged, 5);
    assert.equal(sql.data.sessions.get('motion:1:same-project').cumulative_subunits, 6400000000);
    assert.equal(sql.data.sessions.get('motion:1:same-project').settled_whole_pixels, 5);
});

test('a mid-run tick caps its debit at the wallet balance, retains unpaid usage, and pauses future steps at zero', async () => {
    const sql = createMeteredSqlHarness(2), a = worker(sql), session = build(sql, 'capped-tick', 5.3);
    await a.live.acquireProviderLease(session);
    a.live.secureSession(session, spec, {});
    await assert.rejects(a.verify(), /pixel balance is no longer sufficient/);
    assert.equal(sql.data.members.get('1'), 0); assert.deepEqual(sql.debits, [2]);
    assert.equal(sql.data.sessions.get('motion:1:same-project').cumulative_subunits, 5300000000);
    assert.equal(sql.data.sessions.get('motion:1:same-project').settled_whole_pixels, 2);
    assert.equal(session.settledWholePixels, 2); assert.equal(session.stopIntent, 'pause');
    const notice = session.events.find(event => event.type === 'metered-billing');
    assert.equal(notice.pixelsCharged, 2); assert.equal(notice.pixels, 0);
    assert.ok(session.accepted.objects.length);
});

test('a tick with unchanged usage refreshes the wallet before authorizing another provider step', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), session = build(sql, 'stale-receipt-balance', 6.4);
    await a.live.acquireProviderLease(session);
    a.live.secureSession(session, spec, {});
    assert.equal(await a.verify(), 14);
    assert.equal(await a.verify(), 14);
    sql.data.members.set('1', 0); // Another job spends the remaining balance.
    await assert.rejects(a.verify(), /pixel balance is no longer sufficient/);
    assert.equal(session.stopIntent, 'pause'); assert.deepEqual(sql.debits, [6]);
});

test('buffered completion retains its provider result when the final actual cost exceeds the remaining wallet', async () => {
    const sql = createMeteredSqlHarness(1), a = worker(sql, 2.4);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await a.motion().buildMotionGuide({ cookies: { authToken: 'fixture' }, body: {
        prompt: 'Move the box', duration: 2, aspectRatio: '16:9', llmTier: 'luna', billingSessionId: 'same-project',
    } }, res);
    assert.equal(res.statusCode, 200); assert.ok(res.body.plan.objects.length);
    assert.equal(res.body.llmBilling.pixelsCharged, 1); assert.equal(res.body.llmBilling.pixels, 0);
    assert.equal(res.body.llmBilling.unsettledWholePixels, 1);
    assert.equal(sql.data.sessions.get('motion:1:same-project').cumulative_subunits, 2400000000);
    assert.equal(sql.data.sessions.get('motion:1:same-project').settled_whole_pixels, 1);
});

test('a stale streaming checkpoint preserves committed watermarks and completion adds no second charge', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), b = worker(sql);
    const current = build(sql, 'stale-open-build', 6.4);
    const stale = { ...current, rawProviderPixels: 0, listeners: new Set(), events: [] };
    await a.live.settleLiveBuildAccounting(current, spec);
    await b.live.persist(stale, true);
    assert.equal(checkpoint(sql, current.buildId).accruedSubunits, 6400000000);
    assert.equal(checkpoint(sql, current.buildId).settledWholePixels, 6);
    await b.live.completeAndCharge(stale, spec, { plan: fixture() });
    assert.equal(stale.final.llmBilling.pixelsCharged, 6);
    assert.equal(stale.final.llmBilling.rawPixels, 6.4);
    assert.deepEqual(sql.debits, [6]);
});

test('a commit failure publishes no Three.js billing counters, final result or charge notice', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), session = build(sql, 'commit-failure', 2.4);
    sql.state.beforeCommit = () => { sql.state.beforeCommit = null; throw new Error('commit failed'); };
    await assert.rejects(a.live.settleLiveBuildAccounting(session, spec, { plan: fixture() }), /commit failed/);
    assert.equal(sql.data.members.get('1'), 20); assert.equal(sql.data.events.size, 0);
    assert.equal(session.settledWholePixels, 0); assert.equal(session.accruedSubunits, 0);
    assert.equal(session.final, undefined); assert.equal(session.events.length, 0); assert.deepEqual(a.charged, []);
    assert.equal(sql.data.builds.get(session.buildId).charged, 0);
    await a.live.completeAndCharge(session, spec, { plan: fixture() });
    assert.deepEqual(sql.debits, [2]); assert.equal(session.final.llmBilling.pixelsCharged, 2);
});

test('buffered Spatial planning uses durable shared usage and carries fractions across requests', async () => {
    const sql = createMeteredSqlHarness(20);
    const output = { plan: fixture(5), controlledObject: 'subject', controlMode: 'character', motionStyle: 'walk',
        walkable: [{ min: [-5, 0, -5], max: [5, 2, 5] }], obstacles: [] };
    const results = await Promise.all([1, 2, 3].map(async () => {
        const w = worker(sql, 0.6, output);
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await w.spatial().spatialWorldPlan({ body: { operation: 'reconstruct', prompt: 'Keep the visible box',
            image: 'https://assets.test/source.jpg', aspectRatio: '16:9', drivenName: 'subject', llmTier: 'luna', billingSessionId: 'same-project' } }, res);
        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        return res.body.llmBilling;
    }));
    assert.equal(results.reduce((sum, value) => sum + value.pixelsCharged, 0), 1);
    assert.equal(sql.data.members.get('1'), 19);
    assert.equal(sql.data.sessions.get('spatial:1:same-project').cumulative_subunits, 1800000000);
    assert.equal(sql.data.sessions.get('spatial:1:same-project').carry_subunits, 800000000);
});

class Response extends EventEmitter {
    statusCode = 200; events = [];
    status(code) { this.statusCode = code; return this; }
    setHeader() {} flushHeaders() {}
    json(body) { this.body = body; this.end(); return this; }
    write(line) { this.events.push(JSON.parse(line)); }
    end() { this.ended = true; this.emit('close'); }
}
const continuationSpec = () => ({ kind: 'motion', operation: 'motion-build', price: 1, atCostPricing: true,
    tier: 'luna', planPath: [], duration: 2,
    request: { model: 'gpt-6-luna', messages: [{ role: 'system', content: 'Return the complete scene.' }] },
    finalize: raw => ({ plan: raw }), charge: () => { throw new Error('Live builds must use shared SQL billing'); }, recordUsage() {},
});
const continueRequest = session => ({ body: { live: true, continueBuildId: session.buildId, liveTargetKey: session.targetKey, llmTier: session.tier } });

test('an active provider lease denies another worker Continue without starting inference, then release permits it', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql);
    const source = build(sql, 'leased-continuation', 0);
    await a.live.acquireProviderLease(source);
    const lease = checkpoint(sql, source.buildId).providerLease;
    assert.ok(lease.owner && lease.token && lease.expiresAt > Date.now());
    await a.live.renewProviderLease(source);
    let providerCalls = 0;
    const b = worker(sql, 0.6, fixture(), async function* () {
        providerCalls++;
        yield { type: 'done', text: JSON.stringify(fixture()), usage: {}, model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
    });
    b.routes.registerLivePreparer('motion', async () => continuationSpec());
    const busy = new Response();
    await b.routes.handleLiveRequest(continueRequest(source), busy, 'motion', '1');
    assert.equal(busy.statusCode, 409); assert.equal(busy.body.code, 'BUILD_BUSY');
    assert.ok(busy.body.plan.objects.length); assert.equal(providerCalls, 0);
    assert.equal(checkpoint(sql, source.buildId).providerLease.token, lease.token);
    // A stale checkpoint from the rejected worker must not clear the live lease.
    const stale = b.routes.__liveSessionsForTest.get(source.buildId);
    await b.live.persist(stale, true);
    assert.equal(checkpoint(sql, source.buildId).providerLease.token, lease.token);

    await a.live.releaseProviderLease(source);
    assert.equal(checkpoint(sql, source.buildId).providerLease, null);
    const resumed = new Response();
    await b.routes.handleLiveRequest(continueRequest(source), resumed, 'motion', '1');
    await b.routes.__liveSessionsForTest.get(source.buildId).running;
    assert.equal(providerCalls, 1); assert.ok(resumed.events.find(event => event.type === 'final'));
    assert.equal(checkpoint(sql, source.buildId).providerLease, null);
});

test('an expired lease allows recovery; the previous owner cannot renew or clear its replacement', async () => {
    const sql = createMeteredSqlHarness(20), a = worker(sql), source = build(sql, 'expired-continuation', 0);
    await a.live.acquireProviderLease(source);
    const expired = checkpoint(sql, source.buildId);
    expired.providerLease.expiresAt = Date.now() - 1;
    sql.data.builds.get(source.buildId).checkpoint = JSON.stringify(expired);
    let finish, providerCalls = 0;
    const hold = new Promise(resolve => { finish = resolve; });
    const b = worker(sql, 0.6, fixture(), async function* () {
        providerCalls++;
        yield { type: 'meta', model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
        await hold;
        yield { type: 'done', text: JSON.stringify(fixture()), usage: {}, model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
    });
    b.routes.registerLivePreparer('motion', async () => continuationSpec());
    const resumed = new Response();
    await b.routes.handleLiveRequest(continueRequest(source), resumed, 'motion', '1');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(providerCalls, 1);
    const replacement = checkpoint(sql, source.buildId).providerLease;
    assert.notEqual(replacement.token, source.providerLease.token);
    await assert.rejects(a.live.renewProviderLease(source), error => error.code === 'BUILD_BUSY');
    await a.live.releaseProviderLease(source);
    assert.equal(checkpoint(sql, source.buildId).providerLease.token, replacement.token);
    finish();
    await b.routes.__liveSessionsForTest.get(source.buildId).running;
    assert.equal(checkpoint(sql, source.buildId).providerLease, null);
    assert.ok(resumed.events.find(event => event.type === 'final'));
});

test('another worker reconnects through the actual events route, observes checkpoint/final and stops polling', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const sql = createMeteredSqlHarness(20), owner = worker(sql), observer = worker(sql);
    const session = build(sql, 'foreign-readback', 0);
    await owner.live.acquireProviderLease(session);
    const response = new Response();
    await observer.routes.liveBuildEvents({ query: { buildId: session.buildId, after: '10' } }, response);
    assert.equal(response.statusCode, 200); assert.equal(response.ended, undefined);
    assert.equal(response.events[0].status, 'streaming'); assert.equal(response.events[0].seq, 11);

    session.commitSeq = 2;
    session.accepted = fixture(); session.accepted.objects[0].keys[0].position[0] = 3;
    await owner.live.persist(session, true);
    const saved = structuredClone(sql.data.builds.get(session.buildId)), queryCount = sql.state.queries.length;
    t.mock.timers.tick(2000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(response.events.at(-1).commitSeq, 2);
    assert.equal(response.events.at(-1).plan.objects[0].keys[0].position[0], 3);
    assert.deepEqual(sql.data.builds.get(session.buildId), saved, 'observer must not persist foreign state');
    assert.ok(sql.state.queries.slice(queryCount).every(statement => statement.startsWith('SELECT')));

    await owner.live.completeAndCharge(session, spec, { plan: session.accepted });
    t.mock.timers.tick(2000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(response.events.at(-1).status, 'completed'); assert.ok(response.events.at(-1).final.plan);
    assert.equal(response.ended, true);
    const finishedReads = sql.state.queries.length;
    t.mock.timers.tick(10000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(sql.state.queries.length, finishedReads);
    assert.deepEqual(sql.debits, []);
    t.mock.timers.reset();
});

test('foreign readback ends on pause or lease expiry without changing the producer checkpoint', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    for (const outcome of ['paused', 'expired']) {
        const sql = createMeteredSqlHarness(20), owner = worker(sql), observer = worker(sql);
        const session = build(sql, `foreign-${outcome}`, 0);
        await owner.live.acquireProviderLease(session);
        const response = new Response();
        await observer.routes.liveBuildEvents({ query: { buildId: session.buildId } }, response);
        if (outcome === 'paused') {
            await owner.live.releaseProviderLease(session); session.status = 'paused'; await owner.live.persist(session, true);
        } else {
            const saved = checkpoint(sql, session.buildId); saved.providerLease.expiresAt = Date.now() - 1;
            sql.data.builds.get(session.buildId).checkpoint = JSON.stringify(saved);
        }
        const before = structuredClone(sql.data.builds.get(session.buildId));
        t.mock.timers.tick(2000); await new Promise(resolve => setImmediate(resolve));
        assert.equal(response.events.at(-1).status, 'paused'); assert.equal(response.ended, true);
        if (outcome === 'expired') assert.equal(response.events.at(-1).recoverable, true);
        assert.deepEqual(sql.data.builds.get(session.buildId), before);
    }
    t.mock.timers.reset();
});

test('closing a foreign observer cleans its timers without pausing or releasing the owner', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const sql = createMeteredSqlHarness(20), owner = worker(sql), observer = worker(sql);
    const session = build(sql, 'foreign-disconnect', 0);
    await owner.live.acquireProviderLease(session);
    const response = new Response();
    await observer.routes.liveBuildEvents({ query: { buildId: session.buildId } }, response);
    const lease = checkpoint(sql, session.buildId).providerLease;
    response.emit('close');
    const reads = sql.state.queries.length;
    t.mock.timers.tick(20000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(sql.state.queries.length, reads);
    assert.equal(sql.data.builds.get(session.buildId).status, 'streaming');
    assert.equal(checkpoint(sql, session.buildId).providerLease.token, lease.token);
    assert.equal(session.stopIntent, undefined);
    t.mock.timers.reset();
});

test('a stalled foreign checkpoint read cannot overlap polls or hold the observer past the known lease', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const sql = createMeteredSqlHarness(20), owner = worker(sql), observer = worker(sql);
    const session = build(sql, 'foreign-stalled-query', 0);
    await owner.live.acquireProviderLease(session);
    const response = new Response();
    await observer.routes.liveBuildEvents({ query: { buildId: session.buildId } }, response);
    sql.state.failQuery = async statement => {
        if (statement.startsWith('SELECT * FROM scene_live_builds')) await new Promise(() => {});
    };
    t.mock.timers.tick(2000); await new Promise(resolve => setImmediate(resolve));
    const reads = sql.state.queries.length;
    t.mock.timers.tick(10000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(sql.state.queries.length, reads, 'do not overlap a stalled checkpoint read');
    t.mock.timers.tick(30000); await new Promise(resolve => setImmediate(resolve));
    assert.equal(response.ended, true); assert.equal(response.events.at(-1).status, 'paused');
    assert.equal(response.events.at(-1).recoverable, true);
    assert.equal(sql.data.builds.get(session.buildId).status, 'streaming');
    t.mock.timers.reset();
});

test('billing schema unavailability blocks both prepared Three.js routes before paid provider work', async () => {
    for (const kind of ['motion', 'spatial']) {
        const sql = createMeteredSqlHarness(20), w = worker(sql);
        sql.state.failQuery = async statement => { if (statement.startsWith('CREATE TABLE IF NOT EXISTS ai_metered_billing_')) throw new Error('Billing store unavailable'); };
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        if (kind === 'motion') await w.motion().buildMotionGuide({ cookies: { authToken: 'fixture' }, body: {
            prompt: 'Move the box', duration: 2, aspectRatio: '16:9', llmTier: 'luna',
        } }, res);
        else await w.spatial().spatialWorldPlan({ body: { operation: 'reconstruct', prompt: 'Keep the box',
            image: 'https://assets.test/source.jpg', aspectRatio: '16:9', drivenName: 'subject', llmTier: 'luna' } }, res);
        assert.ok(res.statusCode >= 400); assert.equal(w.providerCalls, 0);
        assert.equal(sql.data.members.get('1'), 20); assert.deepEqual(sql.debits, []);
    }
});

test('a completed provider result survives final debit failure and Continue retries only the save, including after restart', async () => {
    for (const restart of [false, true]) {
        const sql = createMeteredSqlHarness(20);
        let providerCalls = 0;
        const first = worker(sql, 6.4, fixture(), async function* () {
            providerCalls++;
            yield { type: 'meta', model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
            yield { type: 'done', text: JSON.stringify(fixture()), usage: {}, model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
        });
        first.routes.registerLivePreparer('motion', async () => continuationSpec());
        sql.failOnce(statement => statement.startsWith('UPDATE members SET pixels'));
        const initial = new Response();
        await first.routes.handleLiveRequest({ body: { live: true, liveTargetKey: `pending-${restart}` } }, initial, 'motion', '1');
        const session = [...first.routes.__liveSessionsForTest.values()][0];
        await session.running;
        assert.equal(providerCalls, 1); assert.equal(session.status, 'paused');
        assert.ok(session.pendingFinal.result.plan.objects.length);
        assert.ok(checkpoint(sql, session.buildId).pendingFinal.result.plan.objects.length);
        assert.equal(sql.data.members.get('1'), 20); assert.deepEqual(sql.debits, []);

        const retry = restart ? worker(sql) : first;
        retry.routes.registerLivePreparer('motion', async () => { throw new Error('A save-only retry must not prepare another provider request'); });
        const response = new Response();
        await retry.routes.handleLiveRequest(continueRequest(session), response, 'motion', '1');
        const restored = retry.routes.__liveSessionsForTest.get(session.buildId);
        await restored.running;
        assert.equal(providerCalls, 1); assert.equal(retry.providerCalls, 0);
        assert.equal(restored.status, 'completed'); assert.equal(restored.pendingFinal, undefined);
        assert.equal(checkpoint(sql, session.buildId).pendingFinal, null);
        assert.equal(restored.final.llmBilling.pixelsCharged, 6); assert.equal(restored.final.llmBilling.pixels, 14);
        assert.deepEqual(sql.debits, [6]); assert.ok(response.events.find(event => event.type === 'final'));
    }
});

test('when all checkpoint writes fail, the completed result remains retryable in memory without another AI call', async () => {
    const sql = createMeteredSqlHarness(20);
    let providerCalls = 0;
    const first = worker(sql, 2.4, fixture(), async function* () {
        providerCalls++;
        yield { type: 'meta', model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
        yield { type: 'done', text: JSON.stringify(fixture()), usage: {}, model: 'gpt-6-luna', provider: 'openai', liveStreaming: true };
        sql.state.failQuery = async statement => {
            if (/^(?:INSERT INTO|UPDATE) scene_live_builds/.test(statement)) throw new Error('Build store offline');
        };
    });
    first.routes.registerLivePreparer('motion', async () => continuationSpec());
    const initial = new Response();
    await first.routes.handleLiveRequest({ body: { live: true, liveTargetKey: 'pending-memory' } }, initial, 'motion', '1');
    const session = [...first.routes.__liveSessionsForTest.values()][0];
    await session.running;
    assert.ok(session.pendingFinal.result.plan); assert.equal(session.status, 'paused');
    assert.equal(checkpoint(sql, session.buildId).pendingFinal, null);
    sql.state.failQuery = null;
    first.routes.registerLivePreparer('motion', async () => { throw new Error('Must not repeat provider work'); });
    const response = new Response();
    await first.routes.handleLiveRequest(continueRequest(session), response, 'motion', '1');
    await session.running;
    assert.equal(providerCalls, 1); assert.equal(session.status, 'completed');
    assert.deepEqual(sql.debits, [2]); assert.equal(session.pendingFinal, undefined);
});
