const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, name => {
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(root, path.dirname(file), name + '.ts')));
    throw Error(`Unexpected dependency ${name}`);
  });
  return module.exports;
}
const helpers = load('server/src/videoHistory.ts');
function handler(name, bindings) {
  const file = 'server/src/PostDatabase.ts';
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(found, name);
  bindings = { ...helpers, ...load('server/src/imageModelExamples.ts'), ...load('server/src/planVideoMedia.ts'), console: { error() {} }, authenticatedUserId: () => '7', ...bindings };
  const code = ts.transpileModule(`const ${name} = ${found.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), code + `;return ${name};`)(...Object.values(bindings));
}
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
}
const url = index => `https://assets.example/paid-${index}.mp4`;

test('history accepts only URL metadata and deduplicates restores without replacing original time or prompt', () => {
  const normalized = helpers.normalizeVideoHistory({
    'A:0': [{ videoUrl: url(0), createdAt: 10, prompt: 'original', blob: new Blob(['large']), preview: 'blob:old' },
      { videoUrl: url(0), createdAt: 20 }, { videoUrl: 'blob:old', createdAt: 1 }, { videoUrl: 'data:video/mp4;base64,x' }, null],
    'B:1:2': [{ videoUrl: url(1), createdAt: -1 }], invalid: [{ videoUrl: url(2) }],
  });
  assert.deepEqual(normalized, { 'A:0': [{ videoUrl: url(0), createdAt: 10, prompt: 'original' }], 'B:1:2': [{ videoUrl: url(1), createdAt: 0 }] });
  assert.deepEqual(helpers.appendVideoHistory(normalized, 'A:0', { videoUrl: url(0), createdAt: 99, prompt: 'restored' }), normalized);
});

test('nine replacements and restoring an earlier A clip preserve every paid URL across independent saves', async () => {
  const row = { sender: 7, previousVideo: url(0), kontext: 'https://assets.example/legacy-cover.png' };
  const save = handler('VideoDb', { withTransaction: work => work(async (sql, args) => {
    if (sql.startsWith('SELECT')) { assert.match(sql, /FOR UPDATE/); return [{ ...row }]; }
    assert.match(sql, /UPDATE posts SET xv1=\?, kontext=\?/);
    [row.previousVideo, row.kontext] = args;
    return { affectedRows: 1 };
  }) });
  for (let index = 1; index <= 8; index++) {
    const res = response();
    await save({ body: { values: { postId: 9, type: 0, mode: 0, vid: url(index), videoHistoryEntry: { createdAt: index, prompt: `version ${index}` } } } }, res);
    assert.equal(res.code, 200);
  }
  const before = JSON.parse(row.kontext).videoHistory;
  const res = response(); await save({ body: { values: { postId: 9, type: 0, mode: 0, vid: url(1) } } }, res);
  assert.equal(row.previousVideo, url(1));
  const context = JSON.parse(row.kontext);
  assert.deepEqual(context.videoHistory, before);
  assert.deepEqual(context.videoHistory['A:0'].map(item => item.videoUrl), Array.from({ length: 9 }, (_, i) => url(i)));
  assert.deepEqual(new Set(context.retainedMedia.map(item => item.url)), new Set(Array.from({ length: 9 }, (_, i) => url(i))));
  assert.equal(context.cover.url, 'https://assets.example/legacy-cover.png');
  assert.equal(context.cover.deleteOnPostDelete, false);
});

test('story doubled slots retain separate histories and reject fractional scene targets', async () => {
  let write;
  const save = handler('VideoDb', { withTransaction: work => work(async (sql, args) => {
    if (sql.startsWith('SELECT')) { assert.match(sql, /xv2B AS previousVideo/); return [{ sender: 7, previousVideo: url(1), kontext: JSON.stringify({ videoHistory: { 'A:2': [{ videoUrl: url(2), createdAt: 4 }] } }) }]; }
    write = { sql, args }; return {};
  }) });
  const res = response(); await save({ body: { values: { postId: 9, type: 3, mode: 1, vid: url(3) } } }, res);
  assert.equal(res.body.column, 'xv2B');
  const histories = JSON.parse(write.args[1]).videoHistory;
  assert.deepEqual(histories['A:3'].map(item => item.videoUrl), [url(1), url(3)]);
  assert.equal(histories['A:2'][0].videoUrl, url(2));
  const invalid = response(); await save({ body: { values: { postId: 9, type: 0.5, mode: 0, vid: url(4) } } }, invalid);
  assert.equal(invalid.code, 400);
});

test('B replacement retains previous versions and unrelated shot history in the locked context', async () => {
  let write;
  const save = handler('BShotTruthDb', { withTransaction: work => work(async (sql, args) => {
    if (sql.startsWith('SELECT')) return [{ sender: 7,
      bshot: JSON.stringify({ videoarray: [[url(1), url(2)]] }),
      kontext: JSON.stringify({ videoHistory: { 'B:0:1': [{ videoUrl: url(0), createdAt: 1 }] }, characters: [{ url: 'character' }] }) }];
    write = { sql, args }; return {};
  }) });
  const next = { videoarray: [[url(3), url(2)]], imagesarray: [['still-current-image']] };
  const res = response(); await save({ body: { values: { postId: 9, bshot: JSON.stringify(next),
    videoHistory: { 'B:0:0': [{ videoUrl: url(4), createdAt: 2, prompt: 'saved while SQL failed' }] } } } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(JSON.parse(write.args[0]), next);
  const context = JSON.parse(write.args[1]);
  assert.deepEqual(context.videoHistory['B:0:0'].map(item => item.videoUrl), [url(4), url(1), url(3)]);
  assert.deepEqual(context.videoHistory['B:0:1'].map(item => item.videoUrl), [url(0), url(2)]);
  assert.deepEqual(context.characters, [{ url: 'character' }]);
});

test('normal A/B saves enforce owner and report SQL failure without a success receipt', async () => {
  for (const name of ['VideoDb', 'BShotTruthDb']) {
    const values = { postId: 9, type: 0, mode: 0, vid: url(1), bshot: '{"videoarray":[]}' };
    for (const owner of [null, '8']) {
      let writes = 0;
      const save = handler(name, { authenticatedUserId: () => owner,
        withTransaction: work => work(async sql => { if (sql.startsWith('SELECT')) return [{ sender: 7 }]; writes++; return {}; }) });
      const res = response(); await save({ body: { values } }, res);
      assert.equal(res.code, owner ? 403 : 401); assert.equal(writes, 0);
    }
    const save = handler(name, { withTransaction: async () => { throw Error('SQL unavailable'); } });
    const res = response(); await save({ body: { values } }, res);
    assert.equal(res.code, 500); assert.ok(res.body.error);
  }
});

test('plan save builder carries URI-only history and cleanup protects every version until explicit post deletion', () => {
  const plan = load('src/planKontextMedia.ts');
  const input = { 'A:0': [{ videoUrl: url(0), createdAt: 1, blob: new Blob(['large']) }, { videoUrl: url(1), createdAt: 2 }],
    'B:1:0': [{ videoUrl: url(2), createdAt: 3 }] };
  const payload = plan.buildPlanKontextPayload({ videoHistory: input });
  const saved = JSON.parse(plan.serializePlanKontextPayload(payload));
  assert.deepEqual(saved.videoHistory['A:0'][0], { videoUrl: url(0), createdAt: 1 });
  assert.deepEqual(plan.getPlanKontextCleanupUrls(saved).videos, [url(0), url(1), url(2)]);
  assert.deepEqual(plan.getPlanKontextDeletableMedia(saved).videos, [url(0), url(1), url(2)]);
});

test('returning through image Continue merges video history even when the incoming cover is legacy context', async () => {
  for (const incoming of [JSON.stringify({ type: 'clik-plan-media', videoHistory: { 'A:0': [{ videoUrl: url(2), createdAt: 2 }] } }), 'https://assets.example/new-cover.png']) {
    let context;
    const save = handler('PostStory', { withTransaction: work => work(async (sql, args) => {
      if (sql.startsWith('SELECT')) return [{ sender: 7, kontext: JSON.stringify({ type: 'clik-plan-media', videoHistory: { 'A:0': [{ videoUrl: url(1), createdAt: 1 }] } }) }];
      context = JSON.parse(args[args.length - 2]); return {};
    }) });
    const res = response(); await save({ body: { values: { postId: 9, mode: 0, kontext: incoming } } }, res);
    assert.equal(res.body.go, 9);
    assert.ok(context.videoHistory['A:0'].some(entry => entry.videoUrl === url(1)));
    if (incoming.startsWith('{')) assert.equal(context.videoHistory['A:0'].length, 2);
    else assert.equal(context.cover.url, incoming);
  }
});

test('reopening accepts null legacy B truth and seeds the saved current video', async () => {
  const read = handler('SavedVideoUpscales', { execQuery: async () => [{ sender: 7, mode: 0, kontext: 'null', bshot: 'null', xv1: url(1) }] });
  const res = response(); await read({ query: { postId: 9 } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.videoHistory, { 'A:0': [{ videoUrl: url(1), createdAt: 0 }] });
  assert.deepEqual(res.body.retainedMediaUrls, [url(1)]);
});

test('image attribution survives image replacement, Continue and reopening alongside existing paid-video metadata', async () => {
  const imageA = 'https://assets.example/image-a.png', imageB = 'https://assets.example/image-b.png';
  const originalHistory = { 'A:0': [{ videoUrl: url(1), createdAt: 1, prompt: 'Keep this video' }] };
  const row = { sender: 7, mode: 0, kontext: JSON.stringify({ type: 'clik-plan-media', videoHistory: originalHistory,
    imageModels: { [imageA]: 'GPT Image 2.5 Flare' }, characters: [{ url: 'original-character' }] }) };
  const withTransaction = work => work(async (sql, args) => {
    if (sql.startsWith('SELECT')) return [row];
    if (sql.includes('xh1=?')) row.kontext = args[1];
    else row.kontext = args[0];
    return {};
  });
  let res = response();
  await handler('ImageDb', { withTransaction })({ body: { values: { postId: 9, img: imageB, type: 0, mode: 0, imageModel: 'GPT Image 2.5 Sunburst' } } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(JSON.parse(row.kontext).videoHistory, originalHistory);
  res = response();
  await handler('PostStory', { withTransaction })({ body: { values: { postId: 9, mode: 0,
    kontext: JSON.stringify({ type: 'clik-plan-media', imageModels: { [imageB]: 'GPT Image 2.5 Sunburst' } }) } } }, res);
  assert.equal(res.body.go, 9);
  res = response(); await handler('SavedVideoUpscales', { execQuery: async () => [row] })({ query: { postId: 9 } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.imageModels, { [imageA]: 'GPT Image 2.5 Flare', [imageB]: 'GPT Image 2.5 Sunburst' });
  assert.deepEqual(res.body.videoHistory, originalHistory);
});
