const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.join(root, file), mod = new Module(filename, module);
  if (cache.has(filename)) return cache.get(filename).exports;
  cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
function functions(file, names, bindings) {
  const src = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function walk(n) {
    if (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) declarations.push(n.getText(src).replace(/^export /, ''));
    if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(src))) declarations.push('const ' + n.getText(src) + ';');
    ts.forEachChild(n, walk);
  } walk(src);
  assert.equal(declarations.length, names.length);
  const js = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), js + `;return {${names.join(',')}};`)(...Object.values(bindings));
}
function browser() {
  const win = new EventTarget();
  const entries = [{ idx: 6, key: 'my-page', usr: { clikbDeck: { postId: 42 } }, clikbPromptInput: { id: 'composer', baseIndex: 5 } }];
  let index = 0;
  win.location = { href: 'http://clikb.test/images?deck=42' };
  win.history = {
    get state() { return entries[index]; },
    pushState(state) { entries.splice(index + 1); entries.push(structuredClone(state)); index++; },
    go(delta) { const next = index + delta; if (next >= 0 && next < entries.length) { index = next; win.dispatchEvent(new Event('popstate')); } },
    back() { this.go(-1); }, forward() { this.go(1); },
  };
  return win;
}
const { createTemplateHistory } = load('src/templateHistory.ts');
test('template Back/Forward restores views and Close/Use consume only owned entries', () => {
  const win = browser(), original = structuredClone(win.history.state), views = [];
  let closed = 0, applied = 0;
  const h = createTemplateHistory(win, 'gallery', { restore: v => views.push(v), close: () => closed++, busy: () => false });
  h.push('category'); h.push('detail');
  assert.deepEqual(win.history.state.usr, original.usr);
  assert.deepEqual(win.history.state.clikbPromptInput, original.clikbPromptInput);
  assert.equal(win.history.state.idx, 9);
  h.back(); assert.equal(views.at(-1), 'category');
  win.history.forward(); assert.equal(views.at(-1), 'detail');
  h.close(() => { assert.deepEqual(win.history.state, original); applied++; });
  assert.equal(closed, 1); assert.equal(applied, 1); assert.deepEqual(win.history.state, original);
  h.dispose(); assert.deepEqual(win.history.state, original);
  win.history.forward(); assert.deepEqual(win.history.state, original, 'retired popup Forward entries cannot trap the composer');
});
test('cover generation permits detail -> gallery but protects the mounted gallery until complete', () => {
  const win = browser(); let busy = true, view, closed = false;
  const h = createTemplateHistory(win, 'gallery', { restore: v => view = v, close: () => closed = true, busy: () => busy });
  h.push('detail'); h.back(); assert.equal(view, 'gallery');
  h.back(); assert.equal(view, 'gallery'); assert.equal(closed, false);
  busy = false; h.close(); assert.equal(closed, true); assert.equal(win.history.state.idx, 6);
});
test('Original restores authored script and image prompt independently', () => {
  const source = 'Scene 1: Full authored scene. Scene 2: Complete second scene.';
  for (const mode of ['template', 'image']) {
    let template = 'edited script', image = 'edited cover', cancelled = false;
    const { handleRestoreDefault } = functions('src/components/BrainstormChat.tsx', ['handleRestoreDefault'], {
      finalizePromptMode: mode, baseTemplatePrompt: source, baseImagePrompt: 'Single 16:9 cover',
      setFinalizePrompt: v => template = v, setFinalizeImagePrompt: v => image = v,
      setFinImage() {}, cancelFinalizeGeneration: () => cancelled = true,
    });
    handleRestoreDefault();
    assert.equal(template, mode === 'template' ? source : 'edited script');
    assert.equal(image, mode === 'image' ? 'Single 16:9 cover' : 'edited cover');
    assert.equal(cancelled, mode === 'image');
  }
});

function response() { return { code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } }; }
function persistence({ owner = 9, quality = 'hd', fail = false, actor = '2' } = {}) {
  const events = [], row = { id: 42, userid: owner, title: 'Author template', template_prompt: 'Full script', template_image: 'https://bucket/old.jpg', artstyle: '{}' };
  const query = async (sql, args) => {
    if (sql.startsWith('SELECT *')) return [{ ...row }];
    if (sql.startsWith('UPDATE templates4prompt')) { events.push('update'); if (fail) throw Error('Database unavailable'); row.template_image = args[0]; return { affectedRows: 1 }; }
    throw Error('Unexpected SQL: ' + sql);
  };
  const handlers = functions('server/src/PostDatabase.ts', ['templateRequestUser', 'updateTemplateImagePrompt', 'toggleTemplateLibraryPrompt'], {
    authenticatedUserId: req => req.authenticatedUserId || null,
    withTransaction: async fn => { const old = { ...row }; try { const value = await fn(query); events.push('commit'); return value; } catch (e) { Object.assign(row, old); events.push('rollback'); throw e; } },
    assertStoredTemplateImage: async () => events.push('verify-upload'),
    unpackTemplateMetaServer: () => ({ artStyle: 'Anime', category: 'Cinema & Lore', inLibrary: false }),
    packTemplateMetaServer: meta => { assert.equal(meta.artStyle, 'Anime'); assert.equal(meta.category, 'Cinema & Lore'); return JSON.stringify(meta); },
    verifyTemplateCoverReceipt: (_token, user, url, target) => { assert.equal(user, actor); assert.equal(url, 'https://bucket/new.jpg'); assert.equal(target, '42'); return { quality }; },
    queueTemplateAssetCleanup: async (url, tx) => events.push([tx ? 'transaction-cleanup' : 'failed-upload-cleanup', url]),
    drainTemplateAssetCleanup: async () => {}, SERVER_DERIVATIVE_TEMPLATES: [],
  });
  return { ...handlers, events, row };
}
test('library changes reject a forged member id before any database access', async () => {
  const h = persistence(), res = response();
  await h.toggleTemplateLibraryPrompt({ authenticatedUserId: '2', body: { userid: 999, templateId: 42 } }, res);
  assert.equal(res.code, 403); assert.deepEqual(h.events, []);
});
test('shared HD covers persist before old-image cleanup; other authors SD replacements are rejected', async () => {
  for (const quality of ['hd', 'sd2', 'sd']) {
    const h = persistence({ quality }), res = response();
    await h.updateTemplateImagePrompt({ authenticatedUserId: '2', body: { userid: 2, id: 42, template_image: 'https://bucket/new.jpg', coverReceipt: 'verified' } }, res);
    assert.equal(res.code, quality === 'sd' ? 403 : 200);
    if (quality !== 'sd') {
      assert.deepEqual(h.events, ['verify-upload', 'update', ['transaction-cleanup', 'https://bucket/old.jpg'], 'commit']);
      assert.equal(h.row.template_prompt, 'Full script'); assert.equal(res.data.coverQuality, quality);
    } else { assert.equal(h.row.template_image, 'https://bucket/old.jpg'); assert.ok(!h.events.includes('update')); }
  }
});
test('author can use SD; a failed database update preserves old image and reclaims unused upload', async () => {
  const owner = persistence({ owner: 2, quality: 'sd' }), res = response();
  await owner.updateTemplateImagePrompt({ authenticatedUserId: '2', body: { id: 42, template_image: 'https://bucket/new.jpg' } }, res);
  assert.equal(res.code, 200); assert.equal(res.data.coverQuality, 'sd');
  const failing = persistence({ fail: true }), failure = response();
  await failing.updateTemplateImagePrompt({ authenticatedUserId: '2', body: { id: 42, template_image: 'https://bucket/new.jpg' } }, failure);
  assert.equal(failure.code, 500); assert.equal(failing.row.template_image, 'https://bucket/old.jpg');
  assert.deepEqual(failing.events.at(-1), ['failed-upload-cleanup', 'https://bucket/new.jpg']);
  assert.ok(!failing.events.some(event => Array.isArray(event) && event[1].endsWith('old.jpg')));
});

test('Guest account 1 has no author SD privilege in production, with the explicit development exception', async () => {
  const old = process.env.APP_STATE;
  try {
    for (const [mode, quality, expected] of [['prod', 'sd', 403], ['prod', 'hd', 200], ['prod', 'sd2', 200], ['dev', 'sd', 200]]) {
      process.env.APP_STATE = mode;
      const h = persistence({ owner: 1, actor: '1', quality }), res = response();
      await h.updateTemplateImagePrompt({ authenticatedUserId: '1', body: { userid: 1, id: 42, template_image: 'https://bucket/new.jpg' } }, res);
      assert.equal(res.code, expected, mode + ' ' + quality);
    }
  } finally { if (old === undefined) delete process.env.APP_STATE; else process.env.APP_STATE = old; }
});
test('billed cover receipts bind quality, member, output and target; cannot be used as auth tokens', () => {
  const old = process.env.SECRET_KEYY; process.env.SECRET_KEYY = 'template-unit-test-secret-only';
  try {
    const { signTemplateCoverReceipt, verifyTemplateCoverReceipt } = load('server/src/templateCoverReceipt.ts');
    for (const quality of ['sd', 'hd', 'sd2']) {
      const token = signTemplateCoverReceipt({ userId: '2', quality, imageUrl: 'https://bucket/new.jpg', target: '42' });
      assert.equal(verifyTemplateCoverReceipt(token, '2', 'https://bucket/new.jpg', '42').quality, quality);
      assert.throws(() => verifyTemplateCoverReceipt(token, '3', 'https://bucket/new.jpg', '42'));
      assert.throws(() => verifyTemplateCoverReceipt(token, '2', 'https://bucket/fake.jpg', '42'));
      assert.throws(() => verifyTemplateCoverReceipt(token, '2', 'https://bucket/new.jpg', '43'));
      assert.equal(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id, undefined);
    }
  } finally { if (old === undefined) delete process.env.SECRET_KEYY; else process.env.SECRET_KEYY = old; }
});

test('template model labels, routes and client quotes match the existing server prices', () => {
  const { TEMPLATE_COVER_MODELS, templateCoverQualityForRoute } = load('server/src/templateCoverModels.ts');
  const { getImageModelPixelCost } = load('src/imageModels.ts');
  const { mediaChargeFor } = load('server/src/mediaPricing.ts', {
    './spatialVideoSpec': {}, './videoUpscaleSpec': {}, './falH3Spec': {}, './sourceMediaDuration': {},
  });
  for (const [quality, pixels] of [['sd', 1], ['hd', 6], ['sd2', 14]]) {
    const config = TEMPLATE_COVER_MODELS[quality];
    assert.equal(getImageModelPixelCost(config.model), pixels);
    assert.equal(mediaChargeFor('/' + config.route, {}).pixels, pixels);
    assert.equal(templateCoverQualityForRoute('/' + config.route), quality);
  }
  assert.equal(TEMPLATE_COVER_MODELS.hd.label, 'GPT Image 2.6');
  assert.equal(TEMPLATE_COVER_MODELS.sd2.label, 'Seedream 4.5');
  assert.equal(templateCoverQualityForRoute('/unrelated'), undefined);
});

test('durable S3 cleanup preserves shared assets and retries failed deletions', async () => {
  for (const shared of [true, false]) {
    let job = { id: 81, template_prompt: JSON.stringify({ url: 'https://bucket/template-cover-old.jpg' }) };
    let fail = true, deletions = 0, removed = 0;
    const query = async sql => {
      if (sql.startsWith('SELECT id,template_prompt')) return job ? [job] : [];
      if (sql.startsWith('SELECT id FROM templates4prompt')) return shared ? [{ id: 43 }] : [];
      if (sql.startsWith('SELECT')) return [];
      if (sql.startsWith('DELETE')) { removed++; job = null; return { affectedRows: 1 }; }
      throw Error(sql);
    };
    const { drainTemplateAssetCleanup } = load('server/src/templateAssetCleanup.ts', {
      './execQuery': { __esModule: true, default: query, withTransaction: work => work(query) },
      './S3Routes': { postMediaStorageUrl: () => 's3://bucket/template-cover-old.jpg', deleteCloudImageUrl: async () => {
        deletions++; if (fail) throw Error('Temporary S3 failure');
      } },
    });
    await drainTemplateAssetCleanup();
    if (shared) { assert.equal(deletions, 0); assert.equal(removed, 1); }
    else {
      assert.equal(deletions, 1); assert.equal(removed, 0);
      fail = false; await drainTemplateAssetCleanup();
      assert.equal(deletions, 2); assert.equal(removed, 1);
    }
  }
});

test('template deletion removes Library references transactionally before queuing image cleanup', async () => {
  const events = [];
  const query = async (sql, args) => {
    if (sql.startsWith('SELECT userid')) return [{ userid: 2, title: 'My template', template_image: 'https://bucket/old.jpg' }];
    if (sql.startsWith('SELECT id,template_prompt')) return [{ id: 80, template_prompt: '[42,43]' }, { id: 81, template_prompt: '[42]' }];
    if (sql.startsWith('DELETE')) { events.push('delete-template'); return { affectedRows: 1 }; }
    if (sql.startsWith('UPDATE')) { events.push(['library', ...args]); return { affectedRows: 1 }; }
    throw Error(sql);
  };
  const { deleteTemplatePrompt } = functions('server/src/PostDatabase.ts', ['templateRequestUser', 'deleteTemplatePrompt'], {
    authenticatedUserId: req => req.authenticatedUserId, USER_LIBRARY_ROW_TITLE: '__CLIKB_USER_LIBRARY__',
    withTransaction: async fn => { const value = await fn(query); events.push('commit'); return value; },
    queueTemplateAssetCleanup: async (url, tx) => { assert.equal(tx, query); events.push(['cleanup', url]); },
    drainTemplateAssetCleanup: async () => {},
  });
  const res = response();
  await deleteTemplatePrompt({ authenticatedUserId: '2', body: { id: 42 } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(events, ['delete-template', ['library', '[43]', 80], ['library', '[]', 81], ['cleanup', 'https://bucket/old.jpg'], 'commit']);
});

test('Guest deletion is rejected in production and permitted only by the server development setting', async () => {
  const old = process.env.APP_STATE;
  try {
    for (const mode of ['prod', 'dev']) {
      process.env.APP_STATE = mode; const events = [];
      const query = async sql => {
        if (sql.startsWith('SELECT userid')) return [{ userid: 1, title: 'Guest template', template_image: 'https://bucket/old.jpg' }];
        if (sql.startsWith('SELECT id,template_prompt')) return [];
        if (sql.startsWith('DELETE')) { events.push('delete'); return { affectedRows: 1 }; }
        throw Error(sql);
      };
      const { deleteTemplatePrompt } = functions('server/src/PostDatabase.ts', ['templateRequestUser', 'deleteTemplatePrompt'], {
        authenticatedUserId: () => '1', USER_LIBRARY_ROW_TITLE: '__CLIKB_USER_LIBRARY__',
        withTransaction: fn => fn(query), queueTemplateAssetCleanup: async () => events.push('cleanup'), drainTemplateAssetCleanup: async () => {},
      });
      const res = response();await deleteTemplatePrompt({ body: { id: 42, userid: 1, dev: true } }, res);
      assert.equal(res.code, mode === 'prod' ? 403 : 200);
      assert.deepEqual(events, mode === 'prod' ? [] : ['delete', 'cleanup']);
    }
  } finally { if (old === undefined) delete process.env.APP_STATE; else process.env.APP_STATE = old; }
});

test('media billing issues cover receipts only for stored, charged output and leaves ordinary generation unchanged', async () => {
  for (const route of ['/GptImageFlare', '/fluxschnell', '/minimax2', '/ordinary-image']) {
    const events = [], jobs = new Map();
    const query = async (sql, args = []) => {
      if (sql.includes('SUM(pixels)')) return [{ pixels: 0 }];
      if (sql.startsWith('SELECT COALESCE(pixels')) return [{ pixels: 100 }];
      if (sql.includes('INSERT INTO media_generation_jobs')) { jobs.set(args[0], { job_key: args[0], user_id: args[2], pixels: args[4] }); return { affectedRows: 1 }; }
      if (sql.startsWith('SELECT * FROM media_generation_jobs')) return [jobs.get(args[0])];
      if (sql.startsWith('UPDATE members')) { assert.equal(args[0], route === '/minimax2' ? 14 : route === '/GptImageFlare' ? 6 : 1); events.push('debit'); return { affectedRows: 1 }; }
      if (sql.trim().startsWith('UPDATE media_generation_jobs')) return { affectedRows: 1 };
      throw Error(sql);
    };
    const quality = route === '/GptImageFlare' ? 'hd' : route === '/minimax2' ? 'sd2' : 'sd';
    const { withMediaBilling } = load('server/src/mediaBilling.ts', {
      './db': { getPixelsForUser: async () => 100 },
      './execQuery': { __esModule: true, default: query, withTransaction: fn => fn(query) },
      './aiUsageLedger': { recordPixelCharge() {}, setUsageAction() {} },
      './requestAuth': { authenticatedUserId: () => '2', authenticatedOwnerId: () => '2' },
      './mediaPricing': { mediaChargeFor: () => ({ pixels: quality === 'hd' ? 6 : quality === 'sd2' ? 14 : 1, kind: 'image', defaultLabel: 'Image' }) },
      './sourceMediaDuration': { attachMeasuredSourceDuration: async () => {} },
      './S3Routes': { storeNormalizedImage: async source => { assert.equal(source, 'https://provider/image.png'); events.push('upload'); return { imageUrl: 'https://bucket/stored.png' }; }, deleteCloudImageUrl: async () => assert.fail('Unexpected deletion') },
      './templateAssetCleanup': { queueTemplateAssetCleanup: async (_url, _query, delay) => { assert.equal(delay, 7200); events.push('orphan-queue'); } },
      './templateCoverReceipt': { signTemplateCoverReceipt: receipt => { assert.equal(receipt.userId, '2'); assert.equal(receipt.target, '42'); assert.equal(receipt.quality, quality); events.push('receipt'); return 'signed'; } },
    });
    const res = { statusCode: 200, headersSent: false, status(n) { this.statusCode = n; return this; }, setHeader() {}, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    await withMediaBilling(async (_req, response) => { events.push('provider'); response.json({ imageUrl: 'https://provider/image.png' }); })({ path: route, body: { templateCover: true, templateCoverTarget: '42', quality: quality === 'hd' ? 'sd' : 'hd' } }, res, error => { throw error; });
    if (route === '/ordinary-image') { assert.deepEqual(events, ['provider', 'debit']); assert.equal(res.body.coverReceipt, undefined); }
    else { assert.deepEqual(events, ['provider', 'upload', 'orphan-queue', 'debit', 'receipt']); assert.equal(res.body.imageUrl, 'https://bucket/stored.png'); assert.equal(res.body.coverReceipt, 'signed'); }
  }
});

test('Creation RAG supplies template workflow only when its area is selected', () => {
  const { selectConciergePacketKnowledge } = load('server/src/ConciergeKnowledge.ts');
  const packet = { ragId: 'clikb_creation', title: 'Creation', instructions: fs.readFileSync(path.join(root, 'docs/apps live rag fro app control/03_creation_intro.rag.txt'), 'utf8') };
  const selected = area => selectConciergePacketKnowledge(packet, { creation: { mode: 'shorts', controls: { areas: { ['clikb.creation.' + area]: { state: {}, controls: [] } } } } });
  const templates = selected('templates');
  assert.equal(templates.fallback, false);assert.match(templates.instructions, /ai_create_template/);
  assert.match(templates.instructions, /verified HD GPT cover/);assert.match(templates.instructions, /manual_name\/manual_prompt/);
  const storyboard = selected('storybook_grid');
  assert.equal(storyboard.fallback, false);assert.doesNotMatch(storyboard.instructions, /verified HD GPT cover|ai_create_template/);
});

test('overlapping cover requests reserve available pixels and charge independently, including out-of-order failure', async () => {
  for (const failSecond of [false, true]) {
    let balance = 12, transactions = Promise.resolve();
    const jobs = new Map(), providers = new Map(), deductions = [];
    const query = async (raw, args = []) => {
      const sql = raw.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT COALESCE(pixels')) return [{ pixels: balance }];
      if (sql.includes('SUM(pixels)')) return [{ pixels: [...jobs.values()].filter(j => !j.charged_at && ['reserved', 'pending', 'processing'].includes(j.status)).reduce((n, j) => n + j.pixels, 0) }];
      if (sql.startsWith('INSERT INTO media_generation_jobs')) { jobs.set(args[0], { job_key: args[0], user_id: args[2], pixels: args[4], status: 'reserved' }); return { affectedRows: 1 }; }
      if (sql.startsWith('SELECT * FROM media_generation_jobs')) return [jobs.get(args[0])];
      if (sql.startsWith('UPDATE members')) {
        if (balance < args[0]) return { affectedRows: 0 };
        balance -= args[0];deductions.push(args[0]);return { affectedRows: 1 };
      }
      if (sql.startsWith("UPDATE media_generation_jobs SET status = 'succeeded'")) { Object.assign(jobs.get(args[0]), { status: 'succeeded', charged_at: true });return { affectedRows: 1 }; }
      if (sql.startsWith('UPDATE media_generation_jobs SET status = ?')) { jobs.get(args[1]).status = args[0];return { affectedRows: 1 }; }
      if (sql.startsWith('UPDATE media_generation_jobs')) return { affectedRows: 0 };
      throw Error(sql);
    };
    const { withMediaBilling } = load('server/src/mediaBilling.ts', {
      './db': { getPixelsForUser: async () => balance },
      './execQuery': { __esModule: true, default: query, withTransaction: fn => { const task = transactions.then(() => fn(query));transactions = task.catch(() => {});return task; } },
      './aiUsageLedger': { recordPixelCharge() {}, setUsageAction() {} },
      './requestAuth': { authenticatedUserId: () => '2', authenticatedOwnerId: () => '2' },
      './mediaPricing': { mediaChargeFor: () => ({ pixels: 6, kind: 'image', defaultLabel: 'Cover' }) },
      './sourceMediaDuration': { attachMeasuredSourceDuration: async () => {} },
      './S3Routes': { storeNormalizedImage: async url => ({ imageUrl: url.replace('provider', 'bucket') }), deleteCloudImageUrl: async () => {} },
      './templateAssetCleanup': { queueTemplateAssetCleanup: async () => {} },
      './templateCoverReceipt': { signTemplateCoverReceipt: value => JSON.stringify(value) },
    });
    const start = target => {
      const res = { statusCode: 200, headersSent: false, status(n) { this.statusCode = n;return this; }, setHeader() {}, json(body) { this.body = body;return this; }, send(body) { this.body = body;return this; } };
      const task = withMediaBilling(async (_req, response) => {
        const failed = await new Promise(resolve => providers.set(target, resolve));
        if (failed) response.status(502).json({ error: 'Provider failed' });
        else response.json({ imageUrl: `https://provider/${target}.png` });
      })({ path: '/GptImageFlare', body: { templateCover: true, templateCoverTarget: target } }, res, error => { throw error; });
      return { task, res };
    };
    const a = start('42'), b = start('43');
    for (let n = 0; providers.size < 2 && n < 100; n++) await new Promise(setImmediate);
    assert.equal(providers.size, 2);assert.equal(jobs.size, 2);assert.equal(balance, 12);
    const overdraw = start('44');await overdraw.task;
    assert.equal(overdraw.res.statusCode, 402);assert.equal(providers.has('44'), false);
    providers.get('43')(failSecond);await b.task;
    if (failSecond) {
      assert.equal(balance, 12);assert.equal(b.res.body.coverReceipt, undefined);
      const retry = start('44');
      for (let n = 0; !providers.has('44') && n < 100; n++) await new Promise(setImmediate);
      assert.ok(providers.has('44'), 'failed request releases its reservation');
      providers.get('44')(false);await retry.task;
      assert.equal(JSON.parse(retry.res.body.coverReceipt).target, '44');
    } else assert.equal(JSON.parse(b.res.body.coverReceipt).target, '43');
    assert.equal(balance, 6);
    providers.get('42')(false);await a.task;
    assert.equal(JSON.parse(a.res.body.coverReceipt).target, '42');assert.equal(balance, 0);
    assert.deepEqual(deductions, [6, 6]);
  }
});

test('cover completion and seed hydration cannot reorder templates in unchanged categories', () => {
  const { createTemplateOrdering } = load('src/templateOrdering.ts');
  const order = createTemplateOrdering(url => Boolean(url));
  const rows = Array.from({ length: 14 }, (_, i) => ({ id: 'seed-' + i, presetKey: 'preset-' + String(i).padStart(2, '0'),
    name: 'Template ' + i, createdAt: 1, thumbnailUrl: '', category: i < 7 ? 'Shorts & Viral' : 'Interactive Games' }));
  const original = order(rows).filter(t => t.category === 'Shorts & Viral').map(t => t.presetKey);
  for (const completed of [11, 7, 13, 9, 8, 12, 10]) {
    rows[completed].thumbnailUrl = 'https://bucket/' + completed + '.png';
    // A fresh DB response may reorder tied rows and replace fallback IDs/times.
    const fresh = [...rows].reverse().map((t, i) => ({ ...t, id: String(500 + i), createdAt: 100000 - i * 1000 }));
    const sorted = order(fresh);
    assert.deepEqual(sorted.filter(t => t.category === 'Shorts & Viral').map(t => t.presetKey), original);
    assert.ok(sorted.find(t => t.presetKey === rows[completed].presetKey).thumbnailUrl);
  }
});

test('actual App template cache loads once across repeated opens and shares requests after invalidation/pagination', async () => {
  const calls = [], pending = [], ref = current => ({ current });
  const bindings = { useCallback: callback => callback, CLIK_URL: 'http://clikb.test',
    templateLibraryRevisionRef: ref(0), templateLibraryLoadedRevisionRef: ref(-1), templateLibraryFetchVersionRef: ref(0),
    templateLibraryRequestRef: ref(null), activeTemplateUserIdRef: ref(2), dbTemplatesRef: ref([]), templateLibraryRef: ref([]),
    axios: { get: async (url, options) => { calls.push(options.params);return new Promise(resolve => pending.push(resolve)); } },
    getTemplateShowcaseOrders: () => ({}), unpackTemplateMeta: () => ({ artStyle: '', category: 'Shorts & Viral' }),
    mergeDbWithExtrapolatedTemplates: rows => rows, setTemplateLibrary() {}, setHasMoreTemplates() {}, hasMoreTemplates: true,
  };
  const source = ts.createSourceFile('App.tsx', fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['fetchTemplateLibraryPage', 'ensureTemplateLibraryLoaded', 'loadMoreTemplates', 'markTemplateLibraryChanged'];
  const declarations = [];
  function walk(n) { if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(source))) declarations.push('const ' + n.getText(source) + ';');ts.forEachChild(n, walk); } walk(source);
  assert.equal(declarations.length, names.length);
  const code = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const cache = new Function(...Object.keys(bindings), code + `;return {${names.join(',')}};`)(...Object.values(bindings));
  const page = start => ({ data: { templates: Array.from({ length: 200 }, (_, i) => ({ id: start + i, title: 'Template', template_prompt: 'Prompt', time: '2026-01-01' })) } });
  const opening = Array.from({ length: 7 }, () => cache.ensureTemplateLibraryLoaded());
  assert.equal(calls.length, 1);pending.shift()(page(1));await Promise.all(opening);
  await Promise.all(Array.from({ length: 7 }, () => cache.ensureTemplateLibraryLoaded()));assert.equal(calls.length, 1);
  await cache.markTemplateLibraryChanged();assert.equal(calls.length, 1, 'invalidation alone does not query the database');
  const changed = Array.from({ length: 7 }, () => cache.ensureTemplateLibraryLoaded());
  assert.equal(calls.length, 2);pending.shift()(page(1));await Promise.all(changed);
  const more = [cache.loadMoreTemplates(), cache.loadMoreTemplates()];
  assert.equal(calls.length, 3);assert.equal(calls[2].offset, 200);pending.shift()(page(201));await Promise.all(more);
  await cache.ensureTemplateLibraryLoaded();assert.equal(calls.length, 3);assert.equal(bindings.dbTemplatesRef.current.length, 400);
});
