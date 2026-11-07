const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function profileRoutes(owner, active, query, transaction) {
  const filename = path.resolve(__dirname, '../server/src/CreativeProfileRoutes.ts');
  const mod = new Module(filename, module);
  const routes = new Map();
  mod.require = name => ({
    './execQuery': { default: query, withTransaction: transaction },
    './requestAuth': { authenticatedOwnerId: () => owner, authenticatedUserId: () => active },
    './jwtUtils': { generateToken: (id, ownerId) => `${id}:${ownerId}` },
  })[name];
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  mod.exports.registerCreativeProfileRoutes({
    get: (url, handle) => routes.set(url, handle), post() {}, patch() {}, delete: (url, handle) => routes.set(url, handle),
  });
  return async (url, req) => {
    const result = { status: 200 };
    await routes.get(url)(req, {
      set() {},
      status(code) { result.status = code; return this; },
      json(value) { result.body = value; },
      cookie(name, value) { result.cookie = [name, value]; },
    });
    return result;
  };
}

function usernameRoute(owner, query) {
  const run = profileRoutes(owner, owner, query);
  return name => run('/creative-profiles/username', { query: { username: name } });
}

test('valid profile usernames return an explicit availability result for development Guest', async () => {
  const previous = process.env.APP_STATE;
  process.env.APP_STATE = 'dev';
  try {
    const route = usernameRoute('1', async (sql, args) => {
      assert.equal(sql, 'SELECT id FROM members WHERE LOWER(username)=LOWER(?) LIMIT 1');
      return args[0].toLowerCase() === 'existing' ? [{ id: 44 }] : [];
    });
    assert.deepEqual(await route('journey'), { status: 200, body: { available: true } });
    assert.deepEqual(await route('Existing'), { status: 200, body: { available: false } });
    assert.deepEqual(await route('two words'), { status: 200, body: { available: false } });
  } finally {
    if (previous === undefined) delete process.env.APP_STATE;
    else process.env.APP_STATE = previous;
  }
});

test('production Guest gets a permission error and a database failure stays distinct from a taken username', async () => {
  const previous = process.env.APP_STATE;
  process.env.APP_STATE = 'prod';
  try {
    const guest = usernameRoute('1', async () => assert.fail('Production Guest cannot check profile creation'));
    assert.deepEqual(await guest('journey'), { status: 403, body: { message: 'Sign in to create a Creative Profile.' } });
    const main = usernameRoute('7', async () => { throw new Error('Database unavailable'); });
    assert.deepEqual(await main('journey'), { status: 500, body: { message: 'Creative Profiles are temporarily unavailable.' } });
  } finally {
    if (previous === undefined) delete process.env.APP_STATE;
    else process.env.APP_STATE = previous;
  }
});

test('removal locks the owned child, refuses posts and saved drafts, and unlinks only an empty child', async () => {
  const queries = [];
  let hasPost = true;
  let hasDraft = true;
  let removed = false;
  const query = async (sql, args) => {
    queries.push(sql);
    assert.equal(args[0], '101');
    if (sql.startsWith('SELECT member_id')) {
      assert.match(sql, /owner_id=\?.*FOR UPDATE$/);
      return args[1] === '7' && !removed ? [{ member_id: 101 }] : [];
    }
    if (sql.includes('FROM posts')) return hasPost ? [{ id: 11 }] : [];
    if (sql.includes('FROM creation_drafts')) return hasDraft ? [{ draft_id: 'draft-1' }] : [];
    assert.match(sql, /^UPDATE creative_profiles SET deleted_at=/);
    assert.deepEqual(args, ['101', '7']);
    removed = true;
    return { affectedRows: 1 };
  };
  const route = (owner, active) => profileRoutes(owner, active, () => assert.fail('Expected transaction'), work => work(query));
  const remove = (run, memberId = '101') => run('/creative-profiles/:memberId', { params: { memberId } });
  const run = route('7', '101');
  assert.equal((await remove(run, '7')).status, 400);
  assert.equal((await remove(route('9', '9'))).status, 404);
  const blocked = await remove(run);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /delete its posts and saved drafts/);
  assert.equal(blocked.cookie, undefined);
  hasPost = false;
  assert.equal((await remove(run)).status, 409);
  assert.equal(removed, false);
  hasDraft = false;
  assert.deepEqual(await remove(run), { status: 200, body: { activeId: 7 }, cookie: ['authToken', '7:7'] });
  assert.equal((await remove(run)).status, 404);
  assert.equal(queries.filter(sql => sql.startsWith('UPDATE')).length, 1);
});
