const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = ts.createSourceFile('PostDatabase.ts', fs.readFileSync(path.join(root, 'server/src/PostDatabase.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const initializers = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer) initializers.set(node.name.getText(source), node.initializer.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const publication = { exports: {} };
Function('module', 'exports', compile(fs.readFileSync(path.join(root, 'server/src/postPublication.ts'), 'utf8')))(publication, publication.exports);
const constants = publication.exports;
function get(name, bindings = {}) {
  const dependencies = { ...constants, console: { log() {}, error() {} }, ...bindings };
  return Function(...Object.keys(dependencies), compile(`const value = ${initializers.get(name)};`) + ';return value;')(...Object.values(dependencies));
}
const res = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });

test('new image/story inserts mark drafts without shifting positional creation data', async () => {
  for (const [handler, query] of [['PostImage', 'createpostX'], ['PostStory', 'createpostXStory']]) {
    const sql = get(query);
    assert.match(sql, /ratio,\s*video\s*\)/);
    assert.match(sql, /100\s*\)/);
    const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map(x => x.trim());
    let called = false;
    const insert = async (actual, params) => {
      called = true;
      assert.equal(actual, sql);
      assert.equal((sql.match(/\?/g) || []).length, params.length);
      assert.equal(columns.length, params.length + 1);
      for (const key of ['prompt', 'model', 'ratio', 'intent_blueprint_json']) assert.equal(params[columns.indexOf(key)], key === 'intent_blueprint_json' ? 'blueprint' : key);
      return { insertId: 42 };
    };
    const insertPostForProfile = get('insertPostForProfile', {
      withTransaction: work => work(insert),
      canWriteCreativeProfileContent: async (query, member) => query === insert && member === '7',
    });
    const run = get(handler, { [query]: sql, authenticatedUserId: () => '7', insertPostForProfile });
    const response = res();
    await run({ body: { values: { id: 7, mode: 2, prompt: 'prompt', model: 'model', ratio: 'ratio', intentBlueprintJson: 'blueprint' } } }, response);
    assert.equal(called, true); assert.equal(response.body.go, 42);
  }
});

test('all public feed pages, shared links and sitemap exclude explicit drafts; legacy rows remain public', async () => {
  for (const name of ['postsxFeeds', 'postsxMoreFeeds', 'postsxMoreFeedsO', 'postsx', 'postsxMore', 'postsxMoreO', 'postsxClik', 'postsxMoreClik', 'postsxMoreOClik', 'postsxStoryClik']) {
    assert.ok(get(name).includes(constants.PUBLIC_POST_SQL), name);
  }
  for (const name of ['postsxStory', 'postsxMoreStory', 'postsxMoreStoryO']) assert.match(get(name), /posts.video\s*=\s*1/);
  const calls = [], execQuery = async (sql, params) => { calls.push({ sql, params }); return []; };
  for (const options of [{}, { post: 9 }, { before: 9 }]) await get('readGuestPublicPosts', { execQuery, postsxFeeds: get('postsxFeeds') })(options);
  await get('readGuestPostIds', { execQuery })(9);
  assert.ok(calls.every(call => call.sql.includes(constants.PUBLIC_POST_SQL)));
  assert.deepEqual(calls[1].params, [1, 1, 9]);
  assert.equal(constants.PUBLIC_POST_SQL, 'COALESCE(posts.video, 0) <> 100');
});

test('only the signed-in profile owner can read drafts, including later/history pages and forged viewer IDs', async () => {
  for (const [user, expectedPrivate] of [['7', true], ['8', false], [null, false]]) {
    for (const override of [false, true]) {
      for (const handler of ['getProfile', 'getProfileMore']) {
        const calls = [];
        const bindings = { authenticatedUserId: () => user, execQuery: async (sql, params) => { calls.push({ sql, params }); return []; } };
        for (const name of ['profile', 'profile_more', 'profile_moreO']) bindings[name] = get(name);
        const response = res();
        await get(handler, bindings)({ body: { values: { id: 7, id3: 7, lastId: 50, override } } }, response);
        assert.equal(response.code, 200); assert.equal(calls.length, 1);
        assert.equal(calls[0].sql.includes(constants.PUBLIC_POST_SQL), !expectedPrivate);
        assert.match(calls[0].sql, /WHERE\s+posts.sender = \?/);
      }
    }
  }
});

test('indexing publishes Shorts/Cinema atomically, keeps Games draft, and failures cannot publish or resurrect deleted posts', async () => {
  for (const mode of [0, 1, 2]) {
    for (const failure of [null, 'index', 'missing']) {
      let video = 100; const operations = [];
      const run = get('InsertPostSearch', {
        authenticatedUserId: () => '7', createPostSearch: get('createPostSearch'),
        withTransaction: async work => {
          let pendingVideo = video;
          const result = await work(async (sql, params) => {
            operations.push(sql);
            if (sql.startsWith('SELECT')) { assert.deepEqual(params, [42, '7']); return failure === 'missing' ? [] : [{ id: 42, mode }]; }
            if (sql.includes('REPLACE')) { if (failure === 'index') throw Error('DB unavailable'); return { affectedRows: 1 }; }
            if (sql.startsWith('UPDATE')) pendingVideo = 1;
            return { affectedRows: 1 };
          });
          video = pendingVideo; return result;
        },
      });
      const response = res();
      await run({ body: { postId: 42, caption: 'Cars', tags: ['cars'], categories: ['Games'] } }, response);
      assert.equal(video, !failure && mode !== 2 ? 1 : 100);
      assert.equal(response.code, failure === 'missing' ? 404 : failure ? 500 : 200);
      if (!failure && mode !== 2) assert.match(operations.at(-1), /UPDATE posts SET video = 1/);
      if (failure === 'missing') assert.equal(operations.length, 1);
    }
  }
});

test('finishing FFmpeg preserves a draft until the final Thumbnail save', async () => {
  let sql;
  await get('AudioDb', { execQuery: async value => { sql = value; } })({ body: { values: { postId: 42, videourl: 'finished.mp4' } } }, res());
  assert.match(sql, /video = CASE WHEN video = 100 THEN 100 ELSE 1 END/);
});

test('Games publish only after the owned final Spatial/Hotspot save succeeds', async () => {
  const doc = { version: 1, entry: { stageId: 'A', nodeId: 'root' }, stages: [{ id: 'A', scene: { nodes: [{ id: 'root' }] } }] };
  for (const [user, exists, expected] of [[null, true, 401], ['7', false, 404], ['7', true, 200]]) {
    const writes = [];
    const bindings = { Buffer, retainActionLabels: value => value, authenticatedUserId: () => user, execQuery: async (sql, params) => { writes.push({ sql, params }); return { affectedRows: exists ? 1 : 0 }; }, withTransaction: async work => work(async (sql, params) => {
      if (sql.startsWith('SELECT')) return exists ? [{ spatial_experience_json: null }] : [];
      writes.push({ sql, params }); return { affectedRows: 1 };
    }) };
    for (const handler of ['SaveSpatialExperience', 'interactionSave']) {
      writes.length = 0; const response = res();
      await get(handler, bindings)({ body: { postId: 42, spatialExperienceJson: JSON.stringify(doc), values: { id: 42, mainSrc: 'game.mp4' } } }, response);
      assert.equal(response.code, expected);
      if (user && (exists || handler === 'interactionSave')) {
        assert.match(writes[0].sql, /video\s*=\s*1/); assert.match(writes[0].sql, /WHERE id = \? AND sender = \? AND mode = 2/);
        assert.deepEqual(writes[0].params.slice(-2), [42, '7']);
      } else assert.equal(writes.length, 0);
    }
  }
});
