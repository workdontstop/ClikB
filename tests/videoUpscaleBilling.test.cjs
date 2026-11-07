const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const measuredField = '__serverMeasuredDurationSeconds';
function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const upscaleSpec = load('server/src/videoUpscaleSpec.ts', {});
const pricing = load('server/src/mediaPricing.ts', {
  './videoUpscaleSpec': upscaleSpec,
  './sourceMediaDuration': { SERVER_MEASURED_DURATION_FIELD: measuredField, SOURCE_MEDIA_MAX_SECONDS: 10 },
  './spatialVideoSpec': { spatialVideoPixels: () => { throw new Error('Unexpected spatial price lookup'); } },
});
const clientPricing = load('src/mediaPricing.ts', {
  '../server/src/videoUpscaleSpec': upscaleSpec,
  './imageModels': { GPT_IMAGE_25_FLARE_PIXEL_COST: 6, GPT_IMAGE_25_SUNBURST_PIXEL_COST: 24 },
});

function fixture({ seconds = 5, balance = 100 } = {}) {
  const jobs = new Map(), charges = [], deductions = [];
  let currentBalance = balance, transactions = Promise.resolve();
  const query = async (rawSql, args = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT COALESCE(pixels, 0) AS pixels FROM members')) return [{ pixels: currentBalance }];
    if (sql.startsWith('SELECT COALESCE(SUM(pixels), 0) AS pixels')) {
      return [{ pixels: [...jobs.values()].filter(job => String(job.user_id) === String(args[0])
        && !job.charged_at && ['reserved', 'pending', 'processing'].includes(job.status))
        .reduce((total, job) => total + job.pixels, 0) }];
    }
    if (sql.startsWith('SELECT * FROM media_generation_jobs')) {
      const job = jobs.get(args[0]); return job ? [{ ...job }] : [];
    }
    if (sql.startsWith('INSERT INTO media_generation_jobs')) {
      const [key, id, userId, route, pixels, label] = args;
      jobs.set(key, { job_key: key, provider: 'reservation', provider_job_id: id,
        user_id: userId, route, pixels, action_label: label, model_endpoint: null,
        status: 'reserved', charged_at: null });
      return { affectedRows: 1 };
    }
    if (sql.startsWith("UPDATE media_generation_jobs SET status = 'expired'")) return { affectedRows: 0 };
    if (sql.startsWith('UPDATE media_generation_jobs SET job_key =')) {
      const [key, provider, id, endpoint, oldKey, userId] = args, job = jobs.get(oldKey);
      if (!job || job.status !== 'reserved' || String(job.user_id) !== String(userId)) return { affectedRows: 0 };
      jobs.delete(oldKey);
      Object.assign(job, { job_key: key, provider, provider_job_id: id, model_endpoint: endpoint, status: 'pending' });
      jobs.set(key, job); return { affectedRows: 1 };
    }
    if (sql.startsWith('UPDATE members SET pixels = COALESCE(pixels, 0) -')) {
      if (currentBalance < args[2]) return { affectedRows: 0 };
      currentBalance -= args[0]; deductions.push(args[0]); return { affectedRows: 1 };
    }
    if (sql.startsWith("UPDATE media_generation_jobs SET status = 'succeeded'")) {
      Object.assign(jobs.get(args[0]), { status: 'succeeded', charged_at: 'charged' }); return { affectedRows: 1 };
    }
    if (sql.startsWith("UPDATE media_generation_jobs SET status = 'completed_unpaid'")) {
      jobs.get(args[0]).status = 'completed_unpaid'; return { affectedRows: 1 };
    }
    if (sql.startsWith('UPDATE media_generation_jobs SET status = ?')) {
      jobs.get(args[1]).status = args[0]; return { affectedRows: 1 };
    }
    throw new Error('Unexpected billing SQL: ' + sql);
  };
  const billing = load('server/src/mediaBilling.ts', {
    crypto: require('node:crypto'),
    './db': { getPixelsForUser: async () => currentBalance },
    './execQuery': { __esModule: true, default: query, withTransaction: fn => {
      const next = transactions.then(() => fn(query)); transactions = next.catch(() => {}); return next;
    } },
    './aiUsageLedger': { recordPixelCharge: (pixels, source) => charges.push({ pixels, source }), setUsageAction() {} },
    './requestAuth': { authenticatedUserId: req => req.creator || 'creator' },
    './mediaPricing': pricing,
    './sourceMediaDuration': { attachMeasuredSourceDuration: async (_route, body) => {
      // Represents the trusted probe. The actual probe/cap implementation is covered separately.
      body[measuredField] = Math.ceil(seconds);
    } },
  });
  const run = async (handler, req) => {
    const res = { statusCode: 200, headersSent: false, headers: {},
      status(value) { this.statusCode = value; return this; },
      setHeader(name, value) { this.headers[name] = value; },
      json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    let failure; await handler(req, res, error => failure = error); if (failure) throw failure; return res;
  };
  const request = (body = {}) => ({ path: '/upscaleVideo', body: {
    video: 'https://assets.test/input.mp4', duration: 1, billingAction: 'video-upscale', billingScene: 2, ...body,
  } });
  return { jobs, charges, deductions, billing, run, request, balance: () => currentBalance };
}

test('ByteDance server price is 23 P/5s and 46 P/10s, based on trusted source duration', () => {
  for (const [seconds, pixels] of [[5, 23], [10, 46]]) {
    const body = { duration: 1, [measuredField]: seconds, processing_type: 'pro', target_resolution: '4k', target_fps: 120 };
    assert.equal(pricing.mediaChargeFor('/upscaleVideo', body).pixels, pixels);
    assert.equal(clientPricing.expectedMediaCharge('/upscaleVideo', { duration: seconds }).pixels, pixels);
  }
  assert.equal(pricing.mediaChargeFor('/upscaleVideo', { duration: 5 }), null);
});

test('2K authoritative and displayed prices agree at 46 P/5s and 92 P/10s', () => {
  for (const [seconds, pixels] of [[5, 46], [10, 92]]) {
    assert.equal(pricing.mediaChargeFor('/upscaleVideo', { [measuredField]: seconds, targetResolution: '2k' }).pixels, pixels);
    assert.equal(clientPricing.expectedMediaCharge('/upscaleVideo', { duration: seconds, targetResolution: '2k' }).pixels, pixels);
  }
});

test('usable synchronous upscale deducts the measured price and records the backend ledger once', async () => {
  for (const [seconds, pixels] of [[5, 23], [10, 46]]) {
    const f = fixture({ seconds });
    const result = await f.run(f.billing.withMediaBilling(async (_req, res) => res.json({ videoUrl: 'https://provider.test/hd.mp4' })), f.request());
    assert.equal(result.statusCode, 200); assert.equal(f.balance(), 100 - pixels);
    assert.deepEqual(f.deductions, [pixels]);
    assert.deepEqual(f.charges, [{ pixels, source: 'server-media-billing' }]);
    assert.equal(result.headers['X-ClikB-Pixels-Charged'], String(pixels));
    assert.equal(result.headers['X-ClikB-Pixels-Balance'], String(100 - pixels));
    assert.equal([...f.jobs.values()][0].status, 'succeeded');
  }
});

test('failed or empty upscale does not deduct pixels and releases its reservation', async () => {
  for (const handler of [async (_req, res) => res.status(500).json({ error: 'Provider rejected video' }),
    async (_req, res) => res.json({}), async () => { throw new Error('Provider unavailable'); }]) {
    const f = fixture();
    try { await f.run(f.billing.withMediaBilling(handler), f.request()); } catch (error) { assert.match(error.message, /unavailable/); }
    assert.equal(f.balance(), 100); assert.deepEqual(f.charges, []); assert.deepEqual(f.deductions, []);
    assert.equal([...f.jobs.values()][0].status, 'failed');
  }
});

async function startAsync(f) {
  const res = await f.run(f.billing.withMediaBilling(async (_req, response) => response.json({
    status: 'starting', provider: 'replicate', jobId: 'byte-job', modelEndpoint: 'bytedance/video-upscaler',
  })), f.request({ async: true, linkmode: true }));
  assert.equal(res.body.billingPending, true); return res;
}
const pollRequest = () => ({ body: { provider: 'replicate', jobId: 'byte-job', modelEndpoint: 'untrusted-model', linkmode: true } });

test('async ByteDance reserves 46 P, then concurrent/repeated successful polling deducts once', async () => {
  const f = fixture({ seconds: 10 }); await startAsync(f);
  assert.equal(f.balance(), 100); assert.deepEqual(f.deductions, []);
  const receipt = f.jobs.get('replicate:byte-job');
  assert.equal(receipt.pixels, 46); assert.equal(receipt.model_endpoint, 'bytedance/video-upscaler');
  const poll = f.billing.withMediaPollBilling(async (req, res) => {
    assert.equal(req.body.modelEndpoint, 'bytedance/video-upscaler');
    return res.json({ status: 'succeeded', videoUrl: 'https://provider.test/hd.mp4' });
  });
  const results = await Promise.all([f.run(poll, pollRequest()), f.run(poll, pollRequest())]);
  assert.deepEqual(results.map(res => res.headers['X-ClikB-Pixels-Charged']).sort(), ['0', '46']);
  assert.equal(f.balance(), 54); assert.deepEqual(f.deductions, [46]);
  assert.deepEqual(f.charges, [{ pixels: 46, source: 'server-media-billing' }]);
  const repeated = await f.run(poll, pollRequest());
  assert.equal(repeated.headers['X-ClikB-Pixels-Charged'], '0'); assert.equal(f.balance(), 54);
});

test('failed or canceled async ByteDance job releases the hold without a deduction', async () => {
  for (const status of ['failed', 'canceled']) {
    const f = fixture({ balance: 23 }); await startAsync(f);
    await f.run(f.billing.withMediaPollBilling(async (_req, res) => res.json({ status, error: 'No output' })), pollRequest());
    assert.equal(f.balance(), 23); assert.deepEqual(f.charges, []); assert.deepEqual(f.deductions, []);
    assert.equal(f.jobs.get('replicate:byte-job').status, status);
    const next = await f.run(f.billing.withMediaBilling(async (_req, res) => res.json({ videoUrl: 'https://provider.test/next.mp4' })), f.request());
    assert.equal(next.statusCode, 200); assert.equal(f.balance(), 0);
  }
});

test('another user cannot poll or charge an owned ByteDance job', async () => {
  const f = fixture(); await startAsync(f); let providerCalls = 0;
  const res = await f.run(f.billing.withMediaPollBilling(async () => { providerCalls++; }), { ...pollRequest(), creator: 'other-user' });
  assert.equal(res.statusCode, 404); assert.equal(providerCalls, 0); assert.equal(f.balance(), 100);
  assert.deepEqual(f.deductions, []);
});

test('insufficient balance prevents an upscale provider request', async () => {
  const f = fixture({ seconds: 10, balance: 45 }); let providerCalls = 0;
  const res = await f.run(f.billing.withMediaBilling(async () => { providerCalls++; }), f.request());
  assert.equal(res.statusCode, 402); assert.equal(res.body.required, 46);
  assert.equal(providerCalls, 0); assert.equal(f.jobs.size, 0); assert.equal(f.balance(), 45);
});
