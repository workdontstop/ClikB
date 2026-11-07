const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function load(name, dependencies) {
  const filename = path.resolve(__dirname, '../server/src', `${name}.ts`);
  const mod = new Module(filename, module);
  mod.require = key => {
    if (Object.hasOwn(dependencies, key)) return dependencies[key];
    throw new Error(`Unexpected dependency ${key}`);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const events = load('SocialNotificationEvents', {});

function registrationFixture(failNotification = false) {
  const state = { committed: false, writes: [], cookies: 0, code: 0, body: undefined };
  const routes = load('LogRoutes', {
    './execQuery': {
      default: async () => assert.fail('Registration must use its transaction'),
      withTransaction: async work => {
        const pending = [];
        const result = await work(async (sql, values) => {
          pending.push({ sql, values });
          if (sql.includes('INSERT INTO members')) return { insertId: 20 };
          if (failNotification) throw new Error('Notification write failed');
          return { affectedRows: 2 };
        });
        state.committed = true;
        state.writes = pending;
        return result;
      },
    },
    './jwtUtils': { generateToken: () => 'fixture-signed-session' },
    './requestAuth': {},
    './googleIdentity': { verifiedGoogleEmail: async () => 'fixture@example.test' },
    './AppDeckRoutes': {},
    './SocialNotificationEvents': events,
  });
  const response = {
    status(code) { state.code = code; return this; },
    json(body) { state.body = body; return this; },
    cookie() { assert.equal(state.committed, true); state.cookies++; },
  };
  return { state, response, register: routes.registerHandlerGoogle };
}

test('signup commits its real Pixel grant and welcome notifications before establishing the session', async () => {
  const fixture = registrationFixture();
  await fixture.register({ body: { values: { credential: 'fixture' } } }, fixture.response);
  assert.equal(fixture.state.code, 201);
  assert.equal(fixture.state.cookies, 1);
  assert.equal(fixture.state.body.payload.id, 20);
  const member = fixture.state.writes.find(row => row.sql.includes('INSERT INTO members'));
  const notification = fixture.state.writes.find(row => row.sql.includes('INSERT INTO social_notifications'));
  assert.equal(member.values.at(-1), 600);
  assert.deepEqual(notification.values.slice(0, 3), [20, 20, 'welcome:20']);
  assert.match(notification.values[3], /Welcome to ClikBSocial/);
  assert.deepEqual(notification.values.slice(4, 7), [20, 20, 'signup-pixels:20']);
  assert.match(notification.values[7], new RegExp(`${member.values.at(-1)} P added to your Main account`));
});

test('a failed notification write cannot leave a committed new account or an issued session', async t => {
  t.mock.method(console, 'error', () => {});
  const fixture = registrationFixture(true);
  await fixture.register({ body: { values: { credential: 'fixture' } } }, fixture.response);
  assert.equal(fixture.state.code, 500);
  assert.equal(fixture.state.committed, false);
  assert.equal(fixture.state.cookies, 0);
});

test('signup notifications use the supplied credit and reject shared Guest identity before writes', async () => {
  const calls = [];
  await events.recordSignupNotifications(async (sql, values) => calls.push({ sql, values }), 21, 725);
  assert.match(calls[0].values[7], /725 P added/);
  await assert.rejects(events.recordSignupNotifications(async () => assert.fail('Guest must receive no signup writes'), 1, 600));
});
