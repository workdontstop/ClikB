const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const fs = require('node:fs');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../server/src/SocialChatSocket.ts');
const serverRequire = createRequire(filename);
const { WebSocket } = serverRequire('ws');
const fixture = new Module(filename, module);
fixture.require = name => {
  if (name === './requestAuth') return {
    authenticatedUserId: req => req.headers.cookie?.split('=')[1] || null,
    authenticatedOwnerId: req => req.headers.cookie?.split('=')[1] || null,
  };
  if (name === './CreativeProfileRoutes') return { activeCreativeProfileIsOwned: async id => id !== '99' };
  return serverRequire(name);
};
fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { attachSocialChatSocket, pushSocialChange } = fixture.exports;

test('a Post reply keeps its source post through comment, message, and notification writes', async () => {
  const file = path.resolve(__dirname, '../server/src/SocialChatRoutes.ts');
  const routes = new Map();
  const changes = [];
  const writes = [];
  let committed = false;
  const query = async (sql, args) => {
    writes.push({ sql, args });
    if (sql.includes('SELECT writes')) return [{ writes: 0 }];
    if (sql.includes('SELECT sender FROM posts')) return [{ sender: 3 }];
    if (sql.includes('SELECT channel,author_id')) return [{ channel: 'post', author_id: 3, post_id: 42 }];
    if (sql.includes('INSERT INTO comments')) return { insertId: 80 };
    if (sql.includes('INSERT INTO social_messages')) return { insertId: 90 };
    return [];
  };
  const mod = new Module(file, module);
  mod.require = name => ({
    './execQuery': { withTransaction: async work => {
      const result = await work(query);
      committed = true;
      return result;
    } },
    './requestAuth': { authenticatedOwnerId: () => '7', authenticatedUserId: () => '8' },
    './postPublication': { PUBLIC_POST_SQL: 'COALESCE(posts.video,0)<>100' },
    './SocialChatSocket': { pushSocialChange: (...args) => {
      assert.equal(committed, true);
      changes.push(args);
    } },
  })[name];
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  mod.exports.registerSocialChatRoutes({ get() {}, post: (url, handle) => routes.set(url, handle) });
  let result;
  const res = { set() {}, status(code) { this.code = code; return this; }, json(value) { result = value; } };
  const body = { channel: 'post', postId: 42, replyId: 44, body: 'reply' };
  await routes.get('/social/messages')({ headers: { 'x-clikb-active-member': '99' }, body }, res);
  assert.equal(res.code, 409);
  assert.equal(writes.length, 0);
  assert.equal(changes.length, 0);
  await routes.get('/social/messages')({ headers: { 'x-clikb-active-member': '8' }, body }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(result, { id: 90 });
  assert.deepEqual(writes.find(item => item.sql.includes('INSERT INTO comments')).args, [42, 'reply', 8]);
  assert.deepEqual(writes.find(item => item.sql.includes('INSERT INTO social_messages')).args, ['post', 8, 42, null, 44, null, 80, 'reply']);
  assert.deepEqual(writes.find(item => item.sql.includes('INSERT IGNORE INTO social_notifications')).args, [3, 8, 'reply', 42, 90, null, 'reply:90']);
  assert.deepEqual(changes, [['post', { id: 42 }], ['notifications', { members: [3] }]]);
});

test('live Chat authenticates and scopes post, room and notification events', { timeout: 7000 }, async () => {
  const server = createServer();
  const connections = new Set();
  server.on('connection', socket => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
  });
  const origin = 'http://localhost:5173';
  attachSocialChatSocket(server, [origin]);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'ws://127.0.0.1:' + server.address().port + '/social/live';
  const clients = [];
  async function connect(member, scope, id) {
    const socket = new WebSocket(url, { headers: { Origin: origin, Cookie: 'authToken=' + member } });
    clients.push(socket);
    await once(socket, 'open');
    const received = [];
    socket.on('message', data => received.push(JSON.parse(data)));
    const ready = once(socket, 'message');
    socket.send(JSON.stringify({ member, scope, id }));
    assert.equal(JSON.parse((await ready)[0]).scope, 'ready');
    return { socket, received };
  }
  try {
    await assert.rejects(once(new WebSocket(url, { headers: { Origin: 'https://other.example', Cookie: 'authToken=2' } }), 'open'));
    await assert.rejects(once(new WebSocket(url, { headers: { Origin: origin } }), 'open'));
    await assert.rejects(once(new WebSocket(url, { headers: { Origin: origin, Cookie: 'authToken=99' } }), 'open'));
    const feeds = await connect(2, 'feeds');
    const post = await connect(3, 'post', 10);
    const unrelated = await connect(4, 'post', 11);
    const room = await connect(5, 'room', 20);
    const outsider = await connect(6, 'room', 20);
    const postDelivery = Promise.all([once(feeds.socket, 'message'), once(post.socket, 'message')]);
    pushSocialChange('post', { id: 10 });
    await postDelivery;
    const roomDelivery = once(room.socket, 'message');
    pushSocialChange('room', { id: 20, members: [5, 3] });
    await roomDelivery;
    const notification = once(post.socket, 'message');
    pushSocialChange('notifications', { members: [3] });
    await notification;
    const deleted = once(post.socket, 'message');
    pushSocialChange('notifications', { members: [3], deletedNotificationId: 71 });
    assert.deepEqual(JSON.parse((await deleted)[0]), { scope: 'notifications', deletedNotificationId: 71 });
    for (const client of [unrelated, outsider]) {
      const barrier = once(client.socket, 'message');
      pushSocialChange('refresh', { members: [client === unrelated ? 4 : 6] });
      await barrier;
      assert.deepEqual(client.received.map(item => item.scope), ['ready', 'refresh']);
    }
    assert.deepEqual(post.received.map(item => item.scope), ['ready', 'post', 'notifications', 'notifications']);
    assert.deepEqual(room.received.map(item => item.scope), ['ready', 'room']);
  } finally {
    for (const client of clients) client.terminate();
    for (const socket of connections) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
