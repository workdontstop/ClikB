const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { Jimp } = require('../server/node_modules/jimp');

// Compile the real modules with controlled adapters; never contact a provider,
// S3, or the database while validating edit and billing behavior.
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache);
    return Module.prototype.require.call(mod, name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const spec = load('server/src/preciseEditSpec.ts');
const region = () => ({ id: 'r1', x: 0.25, y: 0.25, width: 0.5, height: 0.5, note: 'Make the coat blue' });
const noStorage = { readPublicImageBytes: async () => { throw new Error('Unexpected live image read'); }, storeNormalizedImage: async () => { throw new Error('Unexpected live storage call'); } };
const routes = load('server/src/preciseImageRoute.ts', { './S3Routes': noStorage });
const response = () => ({ statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });
const png = async (width = 16, height = 16, color = 0xff0000ff) => new Jimp({ width, height, color }).getBuffer('image/png');
const baseBody = () => ({ model: 'flare', width: 16, height: 16, imageUrl: 'https://public.example/source.png', regions: [region()], references: [], billingAction: 'precise-image' });

test('server-owned precise model prices include source/output and at most seven extra references', () => {
  assert.deepEqual(spec.PRECISE_MODEL_NAMES, { flare: 'GPT Image 2.6 Flare', sunburst: 'GPT Image 2.6 Sunburst', krea: 'Krea 3' });
  assert.equal(spec.preciseEditPixels('flare', 1080, 1920, 7), 6);
  assert.equal(spec.preciseEditPixels('sunburst', 1080, 1920, 7), 24);
  for (let count = 0; count <= 7; count++) assert.equal(spec.preciseEditPixels('krea', 1080, 1920, count), Math.ceil(333 * (.125 + .025 * 2.0736 * (2 + count))));
  for (const args of [['free', 16, 16, 0], ['krea', 4000, 4000, 0], ['flare', 0, 16, 0], ['krea', 16, 16, 8], ['krea', 16, 16, -1], ['krea', 16, 16, 0.5], ['krea', '16', 16, 0]]) assert.throws(() => spec.preciseEditPixels(...args));
  assert.throws(() => spec.preciseRegions([{ ...region(), width: 1 }]));
  assert.throws(() => spec.preciseRegions([{ ...region(), note: 'x'.repeat(2001) }]));
  assert.throws(() => spec.preciseRegions([region(), region()]));
});

test('quote validates dimensions and explicit extra-reference count', () => {
  const res = response(); routes.preciseImageQuote({ body: { model: 'krea', width: 1080, height: 1920, referenceCount: 3 } }, res);
  assert.equal(res.body.pixels, spec.preciseEditPixels('krea', 1080, 1920, 3));
  const invalid = response(); routes.preciseImageQuote({ body: { model: 'flare', width: 16, height: 16, referenceCount: 8 } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('region schema rejects positive interior overlap while allowing touching edges', async () => {
  const first = { ...region(), x: 0, y: 0, width: .5, height: .5 };
  const second = { ...region(), id: 'r2', x: .5, y: 0, width: .5, height: .5 };
  assert.equal(spec.preciseRegions([first, second]).length, 2);
  assert.equal(spec.preciseRegions([first, { ...second, x: 0, y: .5 }]).length, 2);
  assert.equal(spec.preciseRegions([first, { ...second, x: .5, y: .5 }]).length, 2);
  for (const overlapping of [{ ...second, x: .49 }, { ...second, x: .1, y: .1, width: .1, height: .1 }, { ...first, id: 'r2' }]) {
    assert.throws(() => spec.preciseRegions([first, overlapping]), /cannot overlap/);
  }
  // Do not reject floating-point drift at a touching edge.
  assert.equal(spec.preciseRegions([first, { ...second, x: .5 - 1e-9 }]).length, 2);
  let reads = 0, next = 0;
  const handlers = routes.createPreciseImageHandlers({ readBytes: async () => { reads++; return png(); } });
  const res = response();
  await handlers.validate({ body: { ...baseBody(), regions: [first, { ...second, x: .49 }] } }, res, () => next++);
  assert.equal(res.statusCode, 400); assert.match(res.body.message, /cannot overlap/);
  assert.equal(reads, 0); assert.equal(next, 0);
});

test('GPT uses an exact-resolution black/white union mask and source-first references', async () => {
  const source = { width: 16, height: 16, dataUrl: 'source-pixels' };
  for (const model of ['flare', 'sunburst']) {
    const request = await routes.preciseProviderRequest({ model, source, regions: [region()], references: [{ name: '@BlueCoat', url: 'extra-reference' }] });
    assert.equal(request.endpoint, `openai/gpt-image-2.6/${model}/edit`);
    assert.equal(request.input.quality, model === 'flare' ? 'medium' : 'high');
    assert.deepEqual(request.input.image_urls, ['source-pixels', 'extra-reference']);
    assert.deepEqual(request.input.image_size, { width: 16, height: 16 });
    assert.equal(request.input.output_format, 'png');
    assert.match(request.input.prompt, /Make the coat blue/);
    assert.match(request.input.prompt, /@BlueCoat/);
    const mask = await Jimp.read(Buffer.from(request.input.mask_url.split(',')[1], 'base64'));
    assert.equal(mask.bitmap.width, 16); assert.equal(mask.bitmap.height, 16);
    assert.equal(mask.getPixelColor(0, 0), 0x000000ff);
    assert.equal(mask.getPixelColor(4, 4), 0xffffffff);
    assert.equal(mask.getPixelColor(11, 11), 0xffffffff);
    assert.equal(mask.getPixelColor(12, 12), 0x000000ff);
  }
});

test('Krea uses high regional auto canvas preservation and normalized regions on source index zero', async () => {
  const request = await routes.preciseProviderRequest({ model: 'krea', source: { width: 1080, height: 1920, dataUrl: 'source' }, regions: [region()], references: [] });
  assert.equal(request.endpoint, 'krea/v3/edit');
  assert.equal(request.input.reasoning_level, 'high');
  assert.equal(request.input.regional_edit, true);
  // Auto is intentional for an off-grid source width: explicit dimensions
  // would resize the canvas to Krea's multiples-of-16 output grid.
  assert.equal(request.input.image_size, 'auto');
  assert.deepEqual(request.input.regions, [{ image_idx: 0, x: .25, y: .25, width: .5, height: .5, label: 'region1', note: 'Make the coat blue' }]);
  assert.equal(request.input.mask_url, undefined);
});

test('actual source dimensions and all references are verified before the billing middleware can run', async () => {
  const bytes = await png(), reads = [], calls = [];
  const handlers = routes.createPreciseImageHandlers({ readBytes: async url => { reads.push(url); return bytes; }, subscribe: async (...args) => { calls.push(args); return {}; } });
  const forged = { body: { ...baseBody(), model: 'krea', width: 8, height: 8, referenceCount: 0 } };
  const rejected = response(); let next = 0;
  await handlers.validate(forged, rejected, () => next++);
  assert.equal(rejected.statusCode, 400); assert.equal(next, 0); assert.equal(calls.length, 0);
  const request = { body: { ...baseBody(), model: 'krea', referenceCount: 0, references: [{ name: 'Coat', url: 'https://public.example/coat.png' }] } };
  const accepted = response();
  await handlers.validate(request, accepted, () => next++);
  assert.equal(next, 1); assert.equal(reads.length, 3);
  assert.equal(request.body.width, 16); assert.equal(request.body.height, 16);
  assert.equal(request.body.references.length, 1); assert.match(request.body.references[0].url, /^data:image\/png;base64,/);
  const { mediaChargeFor } = load('server/src/mediaPricing.ts');
  assert.equal(mediaChargeFor('/preciseImage', request.body).pixels, spec.preciseEditPixels('krea', 16, 16, 1));
  const unverified = response(); await handlers.generate({ body: baseBody() }, unverified);
  assert.equal(unverified.statusCode, 400); assert.equal(calls.length, 0);
});

test('oversized decoded dimensions and invalid source URLs are rejected before provider execution', async () => {
  const bytes = Buffer.from(await png()); bytes.writeUInt32BE(100000, 16); bytes.writeUInt32BE(100000, 20);
  await assert.rejects(routes.loadPreciseImage('https://public.example/bomb.png', async () => bytes), /4,220,160/);
  for (const url of ['file:///secret.png', 'http://user:password@public.example/a.png', 'ftp://public.example/a.png']) await assert.rejects(routes.loadPreciseImage(url, async () => { throw new Error('Should not read invalid URLs'); }), /HTTP|credentials/);
});

test('references are capped to source pixel area and a storage failure retains completed output', async () => {
  const original = await png(16, 16), largeReference = await png(32, 32);
  const calls = [];
  const handlers = routes.createPreciseImageHandlers({
    readBytes: async url => url.endsWith('ref.png') ? largeReference : original,
    subscribe: async (endpoint, input) => { calls.push({ endpoint, input }); return { data: { images: [{ url: 'https://provider.example/result.png' }] } }; },
    persist: async () => { throw new Error('Storage unavailable'); },
  });
  const req = { body: { ...baseBody(), references: [{ name: 'Coat', url: 'https://public.example/ref.png' }] } }, res = response();
  let validated = false; await handlers.validate(req, res, () => { validated = true; }); assert.equal(validated, true);
  const bounded = await Jimp.read(Buffer.from(req.body.references[0].url.split(',')[1], 'base64'));
  assert.ok(bounded.bitmap.width * bounded.bitmap.height <= 256);
  await handlers.generate(req, res);
  assert.equal(calls.length, 1); assert.equal(res.body.imageUrl, 'https://provider.example/result.png'); assert.equal(res.body.modelName, 'GPT Image 2.6 Flare');
  const actualSource = await Jimp.read(Buffer.from(calls[0].input.image_urls[0].split(',')[1], 'base64'));
  assert.equal(actualSource.getPixelColor(0, 0), 0xff0000ff);
});

test('prompt reconciliation uses Luna without reasoning, visual grounding, full current context and normal LLM billing', async () => {
  const calls = [], billing = [], usage = [];
  const promptRoutes = load('server/src/precisePromptRoute.ts', {
    './S3Routes': noStorage,
    './llmBilling': { beginLlmRequest() { throw new Error('Unexpected database call'); }, withLlmBilling() { throw new Error('Unexpected database call'); } },
    './aiUsageLedger': { setUsageAction() {}, recordOpenAiUsage() {} },
    './textGeneration': { createRoutedTextClient() { throw new Error('Unexpected live provider'); }, withReplicateFallbackModel() {}, withoutReplicateFallback: async work => work(), REPLICATE_QWEN_MODEL: 'qwen' },
  });
  const handler = promptRoutes.createPrecisePromptHandler({
    beginBilling: async (req, _res, model, options) => { billing.push({ req, model, options }); return { model, charge: { userId: 'u', tier: 'luna', model, pixels: 1 } }; },
    finishBilling: async (payload, charge) => { billing.push(charge); return { ...payload, llmBilling: { pixelsCharged: charge.pixels } }; },
    recordUsage: (...args) => usage.push(args),
    loadImage: async () => ({ width: 16, height: 16, dataUrl: 'data:image/png;base64,grounded-result' }),
    complete: async payload => { calls.push(payload); return { choices: [{ message: { content: JSON.stringify({ prompt: 'A blue-coated traveler beside the same oak tree, shot on a 50mm lens.' }) } }] }; },
  });
  const current = 'A red-coated traveler beside an oak tree, shot on a 50mm lens.';
  const req = { body: { prompt: current, originalContext: { oldPrompt: 'An unrelated earlier scene' }, imageUrl: 'https://public.example/result.png', edits: [{ regions: [region()] }], llmTier: 'astra', llmBatchContinuation: true } };
  const res = response(); await handler(req, res);
  assert.equal(res.statusCode, 200); assert.match(res.body.prompt, /blue-coated/); assert.equal(res.body.llmBilling.pixelsCharged, 1);
  assert.equal(billing[0].req.body.llmTier, 'luna'); assert.equal(billing[0].req.body.llmBatchContinuation, false); assert.equal(billing[0].options.operationCount, 1);
  assert.equal(calls[0].model, 'gpt-6-luna'); assert.equal(calls[0].reasoning_effort, 'none');
  assert.match(calls[0].messages[0].content, /ENTIRE CURRENT/); assert.match(calls[0].messages[0].content, /Never invent story/);
  const context = JSON.parse(calls[0].messages[1].content[0].text);
  assert.equal(context.currentFirstFramePrompt, current); assert.equal(context.acceptedEditsInOrder[0].regions[0].note, 'Make the coat blue');
  assert.deepEqual(context.historicalOriginalContext, { oldPrompt: 'An unrelated earlier scene' });
  assert.equal(calls[0].messages[1].content.length, 1, 'prompt reconciliation must be pure text without image payloads');
  assert.equal(calls[0].messages[1].content.some(c => c.type === 'image_url'), false);
  assert.equal(usage[0][0], 'gpt-6-luna');
});

test('prompt reconciliation updates originalImagePrompt in parallel when present in context', async () => {
  const calls = [];
  const promptRoutes = load('server/src/precisePromptRoute.ts', {
    './S3Routes': noStorage,
    './llmBilling': { beginLlmRequest() { throw new Error('Unexpected database call'); }, withLlmBilling() { throw new Error('Unexpected database call'); } },
    './aiUsageLedger': { setUsageAction() {}, recordOpenAiUsage() {} },
    './textGeneration': { createRoutedTextClient() { throw new Error('Unexpected live provider'); }, withReplicateFallbackModel() {}, withoutReplicateFallback: async work => work(), REPLICATE_QWEN_MODEL: 'qwen' },
  });
  const handler = promptRoutes.createPrecisePromptHandler({
    beginBilling: async () => ({ model: 'gpt-6-luna', charge: { pixels: 1 } }),
    finishBilling: async payload => payload,
    recordUsage: () => {},
    complete: async payload => {
      calls.push(payload);
      const isOriginal = payload.messages[0].content.includes('ORIGINAL UNPACED');
      return { choices: [{ message: { content: JSON.stringify(isOriginal
        ? { originalImagePrompt: 'The adventurer in a blue coat walks to the edge of the cliff.' }
        : { prompt: 'The adventurer in a blue coat standing near a cliff, 50mm.' }) } }] };
    },
  });
  const req = {
    body: {
      prompt: 'The adventurer in a red coat standing near a cliff, 50mm.',
      originalContext: { imagePacing: { originalImagePrompt: 'The adventurer in a red coat walks to the edge of the cliff.' } },
      edits: [{ regions: [region()] }],
    },
  };
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2, 'both first-frame and original prompts must reconcile in parallel');
  assert.match(res.body.prompt, /blue coat standing/);
  assert.match(res.body.originalImagePrompt, /blue coat walks/);
});

test('registration puts server image validation ahead of media billing', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '../server/src/server.ts'), 'utf8');
  assert.match(server, /app\.post\('\/preciseImage',\s*validatePreciseImage,\s*withMediaBilling\(preciseImageRoute\)\)/);
});

test('prompt output uses the same 40,000-character limit as the next reconciliation input', async () => {
  const promptRoutes = load('server/src/precisePromptRoute.ts', {
    './S3Routes': noStorage,
    './llmBilling': {},
    './aiUsageLedger': { setUsageAction() {}, recordOpenAiUsage() {} },
    './textGeneration': {},
  });
  for (const length of [40_000, 40_001]) {
    let billed = 0;
    const handler = promptRoutes.createPrecisePromptHandler({
      beginBilling: async () => ({ model: 'gpt-6-luna', charge: { pixels: 1 } }),
      finishBilling: async payload => { billed++; return payload; },
      loadImage: async () => ({ width: 16, height: 16, dataUrl: 'result' }),
      complete: async () => ({ choices: [{ message: { content: JSON.stringify({ prompt: 'x'.repeat(length) }) } }] }),
    });
    const req = { body: { prompt: 'Current frame', imageUrl: 'https://public.example/result.png', edits: [{ regions: [region()] }] } };
    const res = response(); await handler(req, res);
    if (length === 40_000) {
      assert.equal(res.statusCode, 200); assert.equal(billed, 1);
      assert.equal(promptRoutes.preciseReconciliationInput({ ...req.body, prompt: res.body.prompt }).prompt.length, length);
    } else { assert.equal(res.statusCode, 502); assert.equal(billed, 0); }
  }
});

test('bounded image reader rejects private and mapped addresses, unsafe redirects and oversized streams', async () => {
  const { Readable } = require('node:stream');
  const harness = (addresses, reply) => {
    const requests = [], options = [];
    const { readPublicImageBytes } = load('server/src/S3Routes.ts', {
      dotenv: { config() {} },
      './creationDrafts/retention': { isCreationAssetRetained: async () => false },
      './requestAuth': { authenticatedUserId: () => 'u' },
      'dns/promises': { lookup: async () => addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 })) },
      'node-fetch': { __esModule: true, default: async (url, opts) => { requests.push(url); options.push(opts); return reply; } },
    });
    return { readPublicImageBytes, requests, options };
  };
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'fe80::1']) {
    const h = harness([address]);
    await assert.rejects(h.readPublicImageBytes('https://private.example/image.png'), /Private network/);
    assert.equal(h.requests.length, 0);
  }
  const redirect = harness(['93.184.216.34'], { status: 302, headers: { get: () => 'http://localhost/private.png' } });
  await assert.rejects(redirect.readPublicImageBytes('https://public.example/start.png'), /Localhost/);
  assert.equal(redirect.requests.length, 1);
  const oversized = harness(['93.184.216.34'], { status: 200, ok: true, headers: { get: () => null }, body: Readable.from([Buffer.from('123'), Buffer.from('456')]) });
  await assert.rejects(oversized.readPublicImageBytes('https://public.example/large.png', 4), /too large/);
  const bounded = harness(['93.184.216.34'], { status: 200, ok: true, headers: { get: () => null }, body: Readable.from([Buffer.from('123')]) });
  assert.equal((await bounded.readPublicImageBytes('https://public.example/small.png', 4)).toString(), '123');
  const pinned = await new Promise((resolve, reject) => bounded.options[0].agent.options.lookup('public.example', { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
  assert.deepEqual(pinned, [{ address: '93.184.216.34', family: 4 }]);
});
