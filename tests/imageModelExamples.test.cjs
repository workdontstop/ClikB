const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
const { configureStore } = require('@reduxjs/toolkit');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.VITE_CLIK_URL', "'https://test.invalid'");
  mod._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
const pure = load('server/src/imageModelExamples.ts');
const s3 = name => `https://test-bucket.s3.us-east-1.amazonaws.com/${name}.png`;
const response = () => ({ statusCode: 200, body: null, headers: {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; }, setHeader(k, v) { this.headers[k] = v; } });
function routes(query, deleteImage = async () => {}) {
  return load('server/src/ImageModelExampleRoutes.ts', {
    './execQuery': { __esModule: true, default: query, withTransaction: async fn => fn(query) },
    './requestAuth': { requireAuthenticatedRequest: (_req, _res, next) => next() },
    './S3Routes': { deleteCloudImageUrl: deleteImage, postMediaStorageUrl: url => url.startsWith('https://test-bucket.s3.') ? 's3://test-bucket/' + url.split('/').at(-1) : null },
  });
}

test('one chosen result per exact tier, full/partial/single-model sets and nine registry keys', () => {
  const registry = load('src/imageModels.ts');
  assert.deepEqual(pure.EXAMPLE_IMAGE_MODELS, registry.ACTIVE_IMAGE_MODEL_KEYS);
  const full = pure.EXAMPLE_IMAGE_MODELS.map(model => ({ model, url: s3(model) }));
  assert.equal(Object.keys(pure.chooseModelExampleImages(full)).length, 9);
  const partial = Array.from({ length: 6 }, (_, i) => ({ model: i % 2 ? 'Imagen2' : 'Schnell', url: s3(String(i)) }));
  assert.deepEqual(pure.chooseModelExampleImages(partial, () => 0.99), { Schnell: s3('4'), Imagen2: s3('5') });
  const one = Array.from({ length: 7 }, (_, i) => ({ model: 'Schnell', url: s3(String(i)) }));
  assert.deepEqual(pure.chooseModelExampleImages(one, () => 0.5), { Schnell: s3('3') });
  assert.deepEqual(pure.chooseModelExampleImages([{ model: 'uploaded', url: s3('upload') }, { model: 'Schnell', url: 'blob:pending' }]), {});
  assert.equal(registry.imageModelForGenerationRoute('GptImageFlare'), 'GPT Image 2.5 Flare');
  assert.equal(registry.imageModelForGenerationRoute('GptImageSunburst'), 'GPT Image 2.5 Sunburst');
  assert.equal(registry.getCreationImageModelName('GPT Image 2.5 Flare'), 'GPT Image 2.6 Flare');
  assert.equal(registry.getCreationImageModelName('GPT Image 2.5 Sunburst'), 'GPT Image 2.6 Sunburst');
  assert.equal(registry.imageModelForGenerationRoute('Bannana'), 'Imagen');
  assert.equal(registry.imageModelForGenerationRoute('fluxschnell', 'fal-nano-banana-pro-edit'), 'fluxUltra2');
});

test('list normalizes MySQL JSON without a model-family fallback; save keeps existing S3 URLs', async () => {
  const queries = [];
  const handlers = routes(async (sql, args) => {
    queries.push({ sql, args });
    return sql.startsWith('SELECT') ? [{ id: 4, name: 'Garden', model_images: JSON.stringify({ Imagen2: s3('nano') }) }] : { insertId: 5 };
  });
  let res = response(); await handlers.listImageModelExampleSets({}, res);
  assert.deepEqual(res.body.sets[0].model_images, { Imagen2: s3('nano') });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  const images = { 'GPT Image 2.5 Flare': s3('fast'), 'GPT Image 2.5 Sunburst': s3('pro') };
  res = response(); await handlers.saveImageModelExampleSet({ body: { name: ' Garden ', model_images: images } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(queries[1].args[0], 'Garden'); assert.deepEqual(JSON.parse(queries[1].args[1]), images);
  for (const body of [{ name: '', model_images: images }, { name: 'x', model_images: {} }, { name: 'x', model_images: { wrong: s3('x') } }, { name: 'x', model_images: { Schnell: 'https://external.invalid/x.png' } }]) {
    res = response(); await handlers.saveImageModelExampleSet({ body }, res); assert.equal(res.statusCode, 400);
  }
  assert.equal(queries.length, 2);
});

test('deletion removes only the chosen set files, retains shared samples, and keeps the row on S3 failure', async () => {
  const deleted = [], queries = [];
  const query = async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes('FOR UPDATE')) return [{ id: 3, model_images: { Schnell: s3('own'), Imagen2: s3('shared') } }, { id: 4, model_images: { Imagen2: s3('shared') } }];
    return { affectedRows: 1 };
  };
  let res = response(); await routes(query, async url => deleted.push(url)).deleteImageModelExampleSet({ params: { id: '3' } }, res);
  assert.equal(res.statusCode, 200); assert.deepEqual(deleted, ['s3://test-bucket/own.png']);
  assert.ok(queries.at(-1).sql.startsWith('DELETE')); assert.deepEqual(queries.at(-1).args, ['3']);
  queries.length = 0; res = response();
  const oldError = console.error; console.error = () => {};
  try { await routes(query, async () => { throw Error('S3 down'); }).deleteImageModelExampleSet({ params: { id: '3' } }, res); }
  finally { console.error = oldError; }
  assert.equal(res.statusCode, 500); assert.ok(!queries.some(q => q.sql.startsWith('DELETE')));
});

test('writes are server-side dev-only; public read does not need login', () => {
  const previous = process.env.APP_STATE; let next = 0;
  const handler = routes(async () => []).requireExampleDeveloper;
  try {
    process.env.APP_STATE = 'prod'; const res = response(); handler({}, res, () => next++); assert.equal(res.statusCode, 404); assert.equal(next, 0);
    process.env.APP_STATE = 'dev'; handler({}, response(), () => next++); assert.equal(next, 1);
  } finally { if (previous === undefined) delete process.env.APP_STATE; else process.env.APP_STATE = previous; }
});

test('Redux loads once, refreshes after a write, and ignores an older in-flight list response', async () => {
  let calls = 0, writes = 0; const pending = [];
  const api = load('src/imageModelExamplesSlice.ts', {
    axios: { __esModule: true, default: { get: async () => { calls++; return new Promise(resolve => pending.push(resolve)); }, post: async () => { writes++; } } },
    './SavepromptHelpersLocal': { protectImageModelExampleSources() {} },
  });
  const store = configureStore({ reducer: { imageModelExamples: api.default } });
  const first = store.dispatch(api.loadImageModelExampleSets());
  await store.dispatch(api.loadImageModelExampleSets()); assert.equal(calls, 1);
  await api.saveImageModelExamples('Garden', { Schnell: s3('garden') }); assert.equal(writes, 1); assert.equal(calls, 1);
  const refresh = store.dispatch(api.loadImageModelExampleSets(true)); assert.equal(calls, 2);
  const sets = [{ id: '2', name: 'Garden', model_images: { Schnell: s3('garden') } }];
  pending[1]({ data: { sets } }); await refresh;
  pending[0]({ data: { sets: [] } }); await first;
  assert.deepEqual(store.getState().imageModelExamples.sets, sets);
  await store.dispatch(api.loadImageModelExampleSets()); assert.equal(calls, 2);
});

test('model attribution follows generated bytes, storage aliases and history; unknown/upload images never get a selected model', () => {
  const cache = new Map();
  const slice = load('src/imageModelExamplesSlice.ts', { axios: {}, './SavepromptHelpersLocal': { protectImageModelExampleSources() {} } }, cache);
  const store = configureStore({ reducer: { imageModelExamples: slice.default } });
  const provenance = load('src/imageResultProvenance.ts', { './store': { store }, './imageModelExamplesSlice': slice });
  provenance.recordGeneratedImageModel('GPT Image 2.5 Flare', ['blob:first']);
  provenance.inheritImageResultModel('blob:first', ['blob:first', s3('sd'), s3('hd')], s3('hd'));
  provenance.inheritImageResultModel(s3('hd'), ['blob:history']);
  provenance.inheritImageResultModel('blob:history', [s3('restored')], s3('restored'));
  provenance.recordGeneratedImageModel('uploaded', [s3('upload')]);
  assert.deepEqual(provenance.imageModelsForSources([s3('restored'), s3('unknown')]), { [s3('restored')]: 'GPT Image 2.5 Flare' });
  const candidates = provenance.collectModelExampleCandidates(['blob:first', s3('restored'), s3('unknown'), s3('upload')]);
  assert.deepEqual(pure.chooseModelExampleImages(candidates, () => 0), { 'GPT Image 2.5 Flare': s3('hd') });
  const plan = load('src/planKontextMedia.ts');
  const payload = plan.buildPlanKontextPayload({ imageModels: provenance.imageModelsForSources([s3('hd')]) });
  assert.deepEqual(plan.parsePlanKontext(plan.serializePlanKontextPayload(payload)).payload.imageModels, { [s3('hd')]: 'GPT Image 2.5 Flare' });
});

test('saved example URLs are removed from temporary cleanup and stay protected until the catalog drops them', () => {
  const previousStorage = global.localStorage, previousLog = console.log;
  const values = new Map([['helperimagesprompt', JSON.stringify([{ url: s3('kept'), timestamp: 1 }, { url: s3('other'), timestamp: 1 }])]]);
  global.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; console.log = () => {};
  try {
    const cleanup = load('src/SavepromptHelpersLocal.ts');
    cleanup.protectImageModelExampleSources([s3('kept')], true);
    cleanup.Saveprompthelperfordellater(s3('kept'));
    assert.deepEqual(JSON.parse(values.get('helperimagesprompt')).map(item => item.url), [s3('other')]);
    assert.equal(cleanup.isImageModelExampleSource(s3('kept')), true);
    cleanup.protectImageModelExampleSources([], true);
    assert.equal(cleanup.isImageModelExampleSource(s3('kept')), false);
  } finally { global.localStorage = previousStorage; console.log = previousLog; }
});

test('set save removes chosen URLs from delete-later and normal creation close keeps them without a post save', async () => {
  const previousStorage = global.localStorage;
  const saved = s3('example'), temporary = s3('temporary'), reference = s3('reference'), vip = s3('vip');
  const values = new Map([['helperimagesprompt', JSON.stringify([saved, temporary].map(url => ({ url, timestamp: 1 })))]]);
  global.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  try {
    const cleanup = load('src/SavepromptHelpersLocal.ts');
    const writes = [], deleted = [], cleared = [];
    const api = load('src/imageModelExamplesSlice.ts', {
      axios: { __esModule: true, default: { post: async (url, body) => writes.push({ url, body }) } },
      './SavepromptHelpersLocal': cleanup,
    });
    await api.saveImageModelExamples('Lunar Cafe', { Schnell: saved });
    assert.equal(writes.length, 1);
    assert.ok(writes[0].url.endsWith('/image-model-example-sets'));
    assert.deepEqual(JSON.parse(values.get('helperimagesprompt')).map(item => item.url), [temporary]);

    const source = ts.createSourceFile('PromptToolbar.tsx', fs.readFileSync(path.join(root, 'src/PromptToolbar.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const handlers = {};
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ['startDelete', 'bulkDeleteImages'].includes(node.name.getText(source))) handlers[node.name.getText(source)] = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(source);
    const evaluate = (name, bindings) => {
      const code = ts.transpileModule(`const handler = ${handlers[name].getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      return new Function(...Object.keys(bindings), code + 'return handler;')(...Object.values(bindings));
    };
    const startDelete = evaluate('startDelete', {
      isImageModelExampleSource: cleanup.isImageModelExampleSource,
      CLIK_URL: '/api', axios: { post: async (_url, body) => deleted.push(body.url) },
    });
    const closeCleanup = evaluate('bulkDeleteImages', {
      protectedImageUrls: [vip], ImagesHdCloud: [saved, temporary, vip], referenceImages: [saved, reference], startDelete,
      setImagesHdCloud: value => cleared.push(['images', value]), setReferenceImages: value => cleared.push(['references', value]),
    });
    await closeCleanup();
    assert.deepEqual(deleted, [temporary, reference]);
    assert.deepEqual(cleared, [['images', []], ['references', []]]);
    assert.equal(cleanup.isImageModelExampleSource(saved), true);
  } finally { global.localStorage = previousStorage; }
});
