const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}, cache = new Map()) {
  const filename = path.join(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
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
function response() {
  return { code: 200, statusCode: 200, headersSent: false, headers: {},
    status(n) { this.code = this.statusCode = n; return this; }, set() { return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(data) { this.data = data; return this; }, send(data) { this.data = data; return this; } };
}
const auth = {
  authenticatedUserId: req => req.activeId || null,
  authenticatedOwnerId: req => req.ownerId || null,
};
const image = 'https://bucket/profile-image-20-avatar-abc123.png';

test('profile image receipts bind the Main wallet, active identity, image kind and exact output', () => {
  const old = process.env.SECRET_KEYY; process.env.SECRET_KEYY = 'profile-image-unit-test-only';
  try {
    const receipt = load('server/src/profileImageReceipt.ts');
    const target = receipt.profileImageTarget({ memberId: 20, kind: 'avatar' }, '20');
    const token = receipt.signProfileImageReceipt({ ...target, ownerId: '9', imageUrl: image, quality: 'hd' });
    assert.equal(receipt.verifyProfileImageReceipt(token, '9', target, image).quality, 'hd');
    for (const [owner, value, url] of [
      ['8', target, image], ['9', { ...target, memberId: '21' }, image],
      ['9', { ...target, kind: 'cover' }, image], ['9', target, image + '?other=1'],
    ]) assert.throws(() => receipt.verifyProfileImageReceipt(token, owner, value, url));
    assert.throws(() => receipt.profileImageTarget({ memberId: 9, kind: 'avatar' }, '20'));
    assert.throws(() => receipt.profileImageTarget({ memberId: 20, kind: 'banner' }, '20'));
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    assert.equal(claims.id, undefined, 'a generated-image receipt cannot authenticate a member');
    assert.equal(claims.aud, 'profile-image');
    const direct = receipt.signProfileImageReceipt({ ...target, ownerId: '9', imageUrl: image, quality: 'direct' });
    assert.equal(receipt.verifyProfileImageReceipt(direct, '9', target, image).quality, 'direct');
    const current = receipt.signProfileImageReceipt({ ...target, ownerId: '9', imageUrl: image, quality: 'current' });
    assert.equal(receipt.verifyProfileImageReceipt(current, '9', target, image).quality, 'current');
  } finally { if (old === undefined) delete process.env.SECRET_KEYY; else process.env.SECRET_KEYY = old; }
});

function routeFixture({ fail = false, legacy = false } = {}) {
  const events = [], routes = {};
  let row = { profile_image: 'https://bucket/profile-image-20-avatar-deadbeef.png',
    profile_image_thumb: legacy ? 'https://bucket/hd-0123456789abcdef0123456789abcdef.png' : 'https://bucket/shared-upload.png', billboard1: 'old-cover', billboardthumb1: 'old-cover-thumb' };
  const query = async (sql, args) => {
    if (sql.startsWith('SELECT id FROM templates4prompt')) { assert.match(sql, /FOR UPDATE$/); events.push('asset-lock'); return [{ id: 1 }]; }
    if (sql.startsWith('SELECT profile_image')) { assert.deepEqual(args, ['20']); events.push('member-lock'); return [{ ...row }]; }
    if (sql.startsWith('UPDATE members')) {
      assert.deepEqual(args, [image, image, '20']); events.push('update');
      if (fail) throw Error('Database unavailable');
      if (sql.includes('SET profile_image=')) Object.assign(row, { profile_image: args[0], profile_image_thumb: args[1] });
      else Object.assign(row, { billboard1: args[0], billboardthumb1: args[1] });
      return { affectedRows: 1 };
    }
    throw Error(sql);
  };
  const actual = load('server/src/profileImageReceipt.ts');
  const { registerProfileImageRoutes } = load('server/src/ProfileImageRoutes.ts', {
    './requestAuth': auth,
    './execQuery': { withTransaction: async work => { const old = { ...row }; try { await work(query); events.push('commit'); } catch (error) { row = old; events.push('rollback'); throw error; } } },
    './S3Routes': { assertStoredTemplateImage: async () => events.push('head'), postMediaStorageUrl: url => typeof url === 'string' ? url.replace('https://bucket/', 's3://bucket/') : null },
    './profileImageReceipt': { ...actual, verifyProfileImageReceipt: (token, owner, target, url) => {
      assert.equal(token, 'signed'); assert.equal(owner, '9'); assert.equal(target.memberId, '20'); assert.equal(url, image); events.push('receipt');
    } },
    './templateAssetCleanup': { TEMPLATE_ASSET_CLEANUP: 'cleanup', startTemplateAssetCleanup() {}, drainTemplateAssetCleanup: async () => {},
      queueTemplateAssetCleanup: async (url, tx) => events.push([tx ? 'replacement-cleanup' : 'discard', url]) },
  });
  registerProfileImageRoutes({ post: (name, handler) => routes[name] = handler });
  const request = kind => ({ activeId: '20', ownerId: '9', body: { memberId: 20, kind, imageUrl: image, receipt: 'signed' } });
  return { routes, events, request, row: () => row };
}

test('Use locks cleanup before saving only the active profile and reclaims only generated replacements', async () => {
  for (const kind of ['avatar', 'cover']) {
    const h = routeFixture(), res = response();
    await h.routes['/profile-image/use'](h.request(kind), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.data, { memberId: 20, kind, imageUrl: image, thumbnailUrl: image });
    assert.deepEqual(h.events.slice(0, 5), ['receipt', 'asset-lock', 'head', 'member-lock', 'update']);
    if (kind === 'avatar') {
      assert.deepEqual(h.events.at(-2), ['replacement-cleanup', 'https://bucket/profile-image-20-avatar-deadbeef.png']);
      assert.equal(h.row().billboard1, 'old-cover');
    } else {
      assert.equal(h.row().profile_image, 'https://bucket/profile-image-20-avatar-deadbeef.png');
      assert.equal(h.events.filter(Array.isArray).length, 0, 'unrelated uploaded images are retained');
    }
    assert.equal(h.events.at(-1), 'commit');
  }
});

test('failed saves retain the old image; Discard needs the signed target and queues cleanup without writing members', async () => {
  const h = routeFixture({ fail: true }), res = response();
  await h.routes['/profile-image/use'](h.request('avatar'), res);
  assert.equal(res.code, 400); assert.equal(h.row().profile_image, 'https://bucket/profile-image-20-avatar-deadbeef.png');
  assert.equal(h.events.at(-1), 'rollback'); assert.equal(h.events.filter(Array.isArray).length, 0);
  h.events.length = 0;
  const discard = response(); await h.routes['/profile-image/discard'](h.request('avatar'), discard);
  assert.deepEqual(discard.data, { ok: true }); assert.deepEqual(h.events, ['receipt', ['discard', image]]);
  for (const request of [{ ...h.request('avatar'), ownerId: null }, { ...h.request('avatar'), activeId: '21' }]) {
    h.events.length = 0; const denied = response(); await h.routes['/profile-image/use'](request, denied);
    assert.ok(denied.code >= 400); assert.deepEqual(h.events, []);
  }
});

test('replacing a profile also queues its known legacy crop thumbnail', async () => {
  const h = routeFixture({ legacy: true });
  await h.routes['/profile-image/use'](h.request('avatar'), response());
  assert.ok(h.events.some(value => Array.isArray(value) && value[1] === 'https://bucket/hd-0123456789abcdef0123456789abcdef.png'));
});

test('opening the saved image only issues its bound receipt; removal commits only the still-current target', async () => {
  for (const kind of ['avatar', 'cover']) {
    const events = [], routes = {};
    const saved = kind === 'avatar' ? image : image.replace('avatar', 'cover');
    const other = 'https://bucket/another-profile-image.png';
    let row = { profile_image: kind === 'avatar' ? saved : other, profile_image_thumb: 'shared-thumb',
      billboard1: kind === 'cover' ? saved : other, billboardthumb1: 'shared-cover-thumb' };
    const { registerProfileImageRoutes } = load('server/src/ProfileImageRoutes.ts', {
      './requestAuth': auth,
      './execQuery': { withTransaction: async work => {
        const old = { ...row };
        try { return await work(async (sql, args) => {
          if (sql.startsWith('SELECT profile_image')) { assert.deepEqual(args, ['20']); events.push(sql.endsWith('FOR UPDATE') ? 'lock' : 'read'); return [{ ...row }]; }
          assert.match(sql, /^UPDATE members SET/); assert.deepEqual(args, ['', '', '20']); events.push('clear');
          if (kind === 'avatar') Object.assign(row, { profile_image: '', profile_image_thumb: '' });
          else Object.assign(row, { billboard1: '', billboardthumb1: '' });
        }); } catch (error) { row = old; throw error; }
      } },
      './S3Routes': { postMediaStorageUrl: url => typeof url === 'string' ? url.replace('https://bucket/', 's3://bucket/') : null },
      './profileImageReceipt': { ...load('server/src/profileImageReceipt.ts'),
        signProfileImageReceipt: claims => {
          assert.deepEqual(claims, { memberId: '20', kind, ownerId: '9', imageUrl: saved, quality: 'current' });
          events.push('sign'); return 'saved-receipt';
        },
        verifyProfileImageReceipt: (token, owner, target, url) => {
          assert.equal(token, 'saved-receipt'); assert.equal(owner, '9'); assert.equal(target.kind, kind); assert.equal(url, saved); events.push('verify');
        } },
      './templateAssetCleanup': { startTemplateAssetCleanup() {}, drainTemplateAssetCleanup: async () => {},
        queueTemplateAssetCleanup: async (url, tx) => { assert.equal(url, saved); assert.equal(typeof tx, 'function'); events.push('cleanup'); } },
    });
    registerProfileImageRoutes({ post: (name, handler) => routes[name] = handler });
    const request = { activeId: '20', ownerId: '9', body: { memberId: 20, kind } };
    const opened = response(); await routes['/profile-image/current'](request, opened);
    assert.equal(opened.code, 200);
    assert.deepEqual(opened.data, { memberId: 20, kind, imageUrl: saved, profileImageReceipt: 'saved-receipt' });
    assert.deepEqual(events, ['read', 'sign'], 'inspection never mutates the profile or queues saved-image cleanup');
    for (const endpoint of ['/profile-image/current', '/profile-image/remove']) {
      for (const deniedRequest of [{ ...request, activeId: '21' }, { ...request, ownerId: null }]) {
        events.length = 0; const denied = response(); await routes[endpoint](deniedRequest, denied);
        assert.ok(denied.code >= 400); assert.deepEqual(events, []);
      }
    }
    const removal = { ...request, body: { ...request.body, imageUrl: saved, receipt: 'saved-receipt' } };
    const field = kind === 'avatar' ? 'profile_image' : 'billboard1';
    row[field] = 'changed-since-launch'; events.length = 0;
    const stale = response(); await routes['/profile-image/remove'](removal, stale);
    assert.equal(stale.code, 400); assert.equal(row[field], 'changed-since-launch'); assert.deepEqual(events, ['verify', 'lock']);
    row[field] = saved; events.length = 0;
    const removed = response(); await routes['/profile-image/remove'](removal, removed);
    assert.equal(removed.code, 200); assert.deepEqual(removed.data, { memberId: 20, kind, imageUrl: '', thumbnailUrl: '' });
    assert.deepEqual(events, ['verify', 'lock', 'clear', 'cleanup']);
    assert.equal(kind === 'avatar' ? row.billboard1 : row.profile_image, other, 'the other profile image remains intact');
    events.length = 0;
    const empty = response(); await routes['/profile-image/current'](request, empty);
    assert.equal(empty.data.imageUrl, ''); assert.equal(empty.data.profileImageReceipt, null); assert.deepEqual(events, ['read']);
  }
});

test('Direct upload validates pixels before storage and returns only a temporary receipt, including write-ahead failure cleanup', async () => {
  const { Jimp } = require('../server/node_modules/jimp');
  const bytes = await new Jimp({ width: 32, height: 32, color: 0xff0000ff }).getBuffer('image/png');
  const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  const { validateProfileImageUpload } = load('server/src/profileImageUpload.ts');
  assert.equal(await validateProfileImageUpload(dataUrl), dataUrl);
  const bomb = Buffer.from(bytes); bomb.writeUInt32BE(100_000, 16);
  for (const input of [dataUrl.replace('image/png', 'image/jpeg'), 'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/png;base64,abcd', `data:image/png;base64,${bomb.toString('base64')}`, 'a'.repeat(12 * 1024 * 1024)])
    await assert.rejects(validateProfileImageUpload(input));

  for (const failure of ['', 'queue', 'upload']) {
    const events = [], routes = {};
    const receipt = load('server/src/profileImageReceipt.ts');
    const { registerProfileImageRoutes } = load('server/src/ProfileImageRoutes.ts', {
      './requestAuth': auth, './execQuery': { withTransaction: async () => assert.fail('Upload must not update members') },
      './S3Routes': { postMediaStorageUrl: () => null,
        storeNormalizedImage: async (value, purpose, raster, commit) => {
          assert.equal(value, dataUrl); assert.equal(purpose, 'profile-image-20-avatar'); assert.equal(raster, true);
          await commit(image, async () => { events.push('put-s3'); if (failure === 'upload') throw Error('S3 unavailable'); });
          return { imageUrl: image };
        }, deleteCloudImageUrl: async url => { assert.equal(url, image); events.push('delete-s3'); } },
      './profileImageReceipt': { ...receipt, signProfileImageReceipt: value => {
        assert.deepEqual(value, { memberId: '20', kind: 'avatar', ownerId: '9', imageUrl: image, quality: 'direct' }); events.push('receipt'); return 'signed-direct';
      } },
      './templateAssetCleanup': { startTemplateAssetCleanup() {},
        queueTemplateAssetCleanup: async (url, tx, delay) => { assert.equal(url, image); assert.equal(tx, undefined); assert.equal(delay, 7200); events.push('durable-cleanup'); if (failure === 'queue') throw Error('Queue unavailable'); } },
    });
    registerProfileImageRoutes({ post: (name, handler) => routes[name] = handler });
    const req = { activeId: '20', ownerId: '9', body: { memberId: 20, kind: 'avatar', imageBase64: dataUrl } }, res = response();
    await routes['/profile-image/upload'](req, res);
    assert.equal(res.code, failure ? 400 : 200);
    assert.deepEqual(events, failure === 'queue' ? ['durable-cleanup', 'delete-s3'] : failure === 'upload'
      ? ['durable-cleanup', 'put-s3', 'delete-s3'] : ['durable-cleanup', 'put-s3', 'receipt']);
    if (!failure) assert.deepEqual(res.data, { imageUrl: image, profileImageReceipt: 'signed-direct' });
    for (const body of [{ ...req.body, memberId: 21 }, { ...req.body, imageBase64: 'data:image/png;base64,abcd' }]) {
      events.length = 0; const denied = response(); await routes['/profile-image/upload']({ ...req, body }, denied);
      assert.ok(denied.code >= 400); assert.deepEqual(events, []);
    }
  }
});

test('editing creates a write-ahead provider reference before source locking and releases it after generation', async () => {
  const events = [], copyUrl = 'https://bucket/profile-image-ref-20-avatar-abcd.png';
  const { prepareProfileImageReference } = load('server/src/profileImageReference.ts', {
    './execQuery': { withTransaction: async work => {
      events.push('begin'); await work(async sql => { assert.match(sql, /FOR UPDATE$/); events.push('source-lock'); return [{ id: 1 }]; }); events.push('commit');
    } },
    './S3Routes': { assertStoredTemplateImage: async url => { assert.equal(url, image); events.push('head'); },
      storeNormalizedImage: async (source, purpose, raster, commit) => {
        assert.equal(source, image); assert.equal(purpose, 'profile-image-ref-20-avatar'); assert.equal(raster, true);
        await commit(copyUrl, async () => events.push('copy-s3')); return { imageUrl: copyUrl };
      }, deleteCloudImageUrl: async () => assert.fail('Unexpected deletion') },
    './templateAssetCleanup': { TEMPLATE_ASSET_CLEANUP: 'cleanup',
      queueTemplateAssetCleanup: async (url, tx, delay) => { assert.equal(url, copyUrl); assert.equal(tx, undefined); events.push(delay === 7200 ? 'durable-copy-cleanup' : 'immediate-copy-cleanup'); },
      drainTemplateAssetCleanup: async () => events.push('drain') },
  });
  const reference = await prepareProfileImageReference({ memberId: '20', kind: 'avatar' }, image);
  assert.equal(reference.imageUrl, copyUrl);
  assert.deepEqual(events, ['durable-copy-cleanup', 'begin', 'source-lock', 'head', 'copy-s3', 'commit']);
  events.push('provider-completed'); await reference.release();
  assert.deepEqual(events.slice(-3), ['provider-completed', 'immediate-copy-cleanup', 'drain']);
});

test('the real S3 normalizer commits cleanup before data uploads, object copies and provider downloads', async () => {
  const { Readable, PassThrough } = require('node:stream');
  const filename = 'server/src/S3Routes.ts';
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'storeNormalizedImage');
  assert.ok(declaration);
  const js = ts.transpileModule(declaration.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const mode of ['data', 'copy', 'download']) for (const failQueue of [false, true]) {
    const events = [];
    class PutObjectCommand { constructor(input) { this.input = input; this.kind = 'put'; } }
    class CopyObjectCommand { constructor(input) { this.input = input; this.kind = 'copy'; } }
    class HeadObjectCommand { constructor(input) { this.input = input; this.kind = 'head'; } }
    const bindings = { BUCKET_NAME: 'bucket', REGION: 'region', NORMALIZE_IMAGE_MAX_BYTES: 1024, NORMALIZE_IMAGE_TIMEOUT_MS: 1000,
      NormalizeImageError: Error, normalizeImageContentType: value => value, isSupportedRaster: () => true,
      createNormalizedImageKey: async () => 'planned.png', getPublicS3Url: () => image,
      tryGetOwnS3Key: value => value.includes('own-source') ? 'source.png' : null,
      PutObjectCommand, CopyObjectCommand, HeadObjectCommand,
      createByteLimitTransform: () => new PassThrough(),
      fetchPublicImage: async url => ({ finalUrl: url, upstream: { ok: true, headers: { get: name => name === 'content-type' ? 'image/png' : null }, body: Readable.from([Buffer.from('png')]) } }),
      s3Client: { send: async command => {
        events.push(command.kind);
        if (command.kind === 'head') return { ContentLength: 3, ContentType: 'image/png' };
        if (command.kind === 'put' && !Buffer.isBuffer(command.input.Body)) for await (const _chunk of command.input.Body) { /* consume provider stream */ }
        return {};
      } },
    };
    const normalize = new Function(...Object.keys(bindings), js + ';return storeNormalizedImage;')(...Object.values(bindings));
    const input = mode === 'data' ? 'data:image/png;base64,cG5n' : mode === 'copy' ? 'https://bucket/own-source.png' : 'https://provider.example/new.png';
    const operation = normalize(input, 'profile-image-20-avatar', true, async (url, upload) => {
      assert.equal(url, image); events.push('durable-cleanup'); if (failQueue) throw Error('Queue unavailable'); await upload();
    });
    if (failQueue) await assert.rejects(operation, /Queue unavailable/); else assert.equal((await operation).imageUrl, image);
    assert.deepEqual(events, [...(mode === 'copy' ? ['head'] : []), 'durable-cleanup', ...(failQueue ? [] : [mode === 'copy' ? 'copy' : 'put'])]);
  }
});

test('profile generation charges the Main wallet, stores before billing, and rejects wrong identities before provider work', async () => {
  for (const [route, quality, pixels] of [['/fluxschnell', 'sd', 1], ['/GptImageFlare', 'hd', 6], ['/minimax2', 'sd2', 14]]) {
   for (const edit of [false, true]) {
    const events = [], jobs = new Map();
    const query = async (raw, args = []) => {
      const sql = raw.replace(/\s+/g, ' ').trim();
      if (sql.includes('SUM(pixels)')) return [{ pixels: 0 }];
      if (sql.startsWith('SELECT COALESCE(pixels')) { assert.equal(args[0], '9'); return [{ pixels: 100 }]; }
      if (sql.startsWith('INSERT INTO media_generation_jobs')) { assert.equal(args[2], '9'); jobs.set(args[0], { job_key: args[0], user_id: args[2], pixels: args[4] }); return { affectedRows: 1 }; }
      if (sql.startsWith('SELECT * FROM media_generation_jobs')) return [jobs.get(args[0])];
      if (sql.startsWith('UPDATE members')) { assert.deepEqual(args, [pixels, '9', pixels]); events.push('debit-main'); return { affectedRows: 1 }; }
      if (sql.startsWith('UPDATE media_generation_jobs')) return { affectedRows: 1 };
      throw Error(sql);
    };
    const { withMediaBilling } = load('server/src/mediaBilling.ts', {
      './db': { getPixelsForUser: async owner => { assert.equal(owner, '9'); return 100; } },
      './execQuery': { __esModule: true, default: query, withTransaction: work => work(query) },
      './requestAuth': auth, './aiUsageLedger': { recordPixelCharge() {}, setUsageAction() {} },
      './mediaPricing': { mediaChargeFor: () => ({ pixels, kind: 'image', defaultLabel: 'Image' }) },
      './sourceMediaDuration': { attachMeasuredSourceDuration: async () => {} },
      './S3Routes': { storeNormalizedImage: async (url, purpose, raster, commit) => {
        assert.equal(url, 'https://provider/new.png'); assert.equal(purpose, 'profile-image-20-avatar'); assert.equal(raster, true);
        await commit(image, async () => events.push('store')); return { imageUrl: image };
      }, deleteCloudImageUrl: async () => assert.fail('Unexpected deletion') },
      './templateAssetCleanup': { queueTemplateAssetCleanup: async (url, _query, delay) => { assert.equal(url, image); assert.equal(delay, 7200); events.push('cleanup-job'); } },
      './profileImageReference': { prepareProfileImageReference: async (target, url) => {
        assert.deepEqual(target, { memberId: '20', kind: 'avatar' }); assert.equal(url, image); events.push('reference-copy');
        return { imageUrl: 'https://bucket/provider-reference.png', release: async () => events.push('release-reference') };
      } },
      './profileImageReceipt': { ...load('server/src/profileImageReceipt.ts'), verifyProfileImageReceipt: (receipt, owner, target, url) => {
        assert.equal(receipt, 'direct-receipt'); assert.equal(owner, '9'); assert.equal(target.memberId, '20'); assert.equal(url, image); events.push('source-receipt');
      }, signProfileImageReceipt: value => {
        assert.deepEqual(value, { memberId: '20', kind: 'avatar', ownerId: '9', imageUrl: image, quality }); events.push('receipt'); return 'signed';
      } },
    });
    const handler = withMediaBilling(async (req, res) => {
      if (edit) assert.deepEqual(req.body.sampleImages, ['https://bucket/provider-reference.png']);
      else assert.equal(req.body.sampleImages, undefined);
      events.push('provider'); res.json({ imageUrl: 'https://provider/new.png' });
    });
    const req = { activeId: '20', ownerId: '9', path: route, body: { profileImage: { memberId: 20, kind: 'avatar',
      ...(edit ? { source: { imageUrl: image, receipt: 'direct-receipt' } } : {}) } } }, res = response();
    await handler(req, res, error => { throw error; });
    assert.deepEqual(events, [...(edit ? ['source-receipt', 'reference-copy'] : []), 'provider', 'cleanup-job', 'store', 'debit-main', 'receipt', ...(edit ? ['release-reference'] : [])]);
    assert.equal(res.data.imageUrl, image); assert.equal(res.data.profileImageReceipt, 'signed'); assert.equal(res.data.coverReceipt, undefined);
    assert.equal(decodeURIComponent(res.headers['X-ClikB-Billing-Label']), 'Profile Picture');
    for (const invalid of [{ ...req, body: { profileImage: { memberId: 21, kind: 'avatar' } } }, { ...req, path: '/unsupported' }]) {
      events.length = 0; const denied = response(); await handler(invalid, denied, error => { throw error; });
      assert.equal(denied.code, 400); assert.deepEqual(events, []);
    }
   }
  }
});

test('profile cleanup locks its work item and preserves images saved on any profile', async () => {
  for (const saved of [true, false]) {
    let job = { id: 81, template_prompt: JSON.stringify({ url: image }) };
    const events = [];
    const query = async sql => {
      if (sql.startsWith('SELECT id,template_prompt')) { if (sql.includes('FOR UPDATE')) events.push('cleanup-lock'); return job ? [job] : []; }
      if (sql.startsWith('SELECT id FROM members')) return saved ? [{ id: 20 }] : [];
      if (sql.startsWith('SELECT')) return [];
      if (sql.startsWith('DELETE')) { events.push('remove-job'); job = null; return { affectedRows: 1 }; }
      throw Error(sql);
    };
    const { drainTemplateAssetCleanup } = load('server/src/templateAssetCleanup.ts', {
      './execQuery': { __esModule: true, default: query, withTransaction: async work => { events.push('begin'); await work(query); events.push('commit'); } },
      './S3Routes': { postMediaStorageUrl: () => 's3://bucket/profile-image-20-avatar-abc123.png', deleteCloudImageUrl: async () => events.push('delete-s3') },
    });
    await drainTemplateAssetCleanup();
    assert.deepEqual(events, saved ? ['begin', 'cleanup-lock', 'remove-job', 'commit'] : ['begin', 'cleanup-lock', 'delete-s3', 'remove-job', 'commit']);
  }
});

function promptHandler(bindings) {
  const filename = 'server/src/GptApi.ts';
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), 'utf8'), ts.ScriptTarget.Latest, true);
  let declaration;
  function walk(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'GptProfileImagePrompt') declaration = node.getText(source); ts.forEachChild(node, walk); } walk(source);
  assert.ok(declaration);
  const js = ts.transpileModule('const ' + declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), js + ';return GptProfileImagePrompt;')(...Object.values(bindings));
}

test('prompt rewriting validates before AI work and uses selected billed operations with stable retry identity', async () => {
  const events = [];
  const handler = promptHandler({ ...load('server/src/profileImageReceipt.ts'), ...auth,
    randomUUID: () => 'fresh-id', imagePacingFingerprint: JSON.stringify,
    beginLlmRequest: async (req, _res, _default, { operations }) => { events.push(['llm', req.body.llmTier, operations[0]]); return { model: 'selected-model', inference: 'selected-inference' }; },
    runBilledLlmOperation: async (_llm, _operation, work) => ({ value: await work(), billing: { charged: true } }),
    generateGPT4oPrompt5B: async (messages, model, inference) => {
      assert.equal(model, 'selected-model'); assert.equal(inference, 'selected-inference');
      assert.match(messages[0].content, /circular crop/); assert.match(messages[1].content, /blue coat/);
      return 'Portrait of the same hero wearing a blue coat';
    },
  });
  const request = { activeId: '20', body: { memberId: 20, kind: 'avatar', request: 'blue coat', imagePrompt: 'hero portrait', promptOperationId: 'retry-id', llmTier: 'boost' } };
  const res = response(); await handler(request, res);
  assert.equal(res.code, 200); assert.match(res.data.imagePrompt, /blue coat/); assert.deepEqual(res.data.llmBilling, { charged: true });
  assert.equal(events[0][1], 'boost');
  assert.equal(events[0][2].operationKey, 'profile-image:retry-id');
  assert.equal(events[0][2].actionLabel, 'Profile Picture Prompt');
  for (const body of [{ ...request.body, memberId: 21 }, { ...request.body, request: '' }, { ...request.body, imagePrompt: 'a'.repeat(6001) }]) {
    events.length = 0; const invalid = response(); await handler({ ...request, body }, invalid);
    assert.ok(invalid.code >= 400); assert.deepEqual(events, []);
  }
});
