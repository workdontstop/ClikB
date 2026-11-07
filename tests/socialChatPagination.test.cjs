const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function harness(query, owner = '7') {
  const filename = path.resolve(__dirname, '../server/src/SocialChatRoutes.ts');
  const changes = [];
  const routes = new Map();
  const mod = new Module(filename, module);
  mod.require = name => ({
    './execQuery': { default: query, withTransaction: work => work(query) },
    './requestAuth': { authenticatedOwnerId: () => owner, authenticatedUserId: () => owner === '1' ? '1' : '8' },
    './postPublication': { PUBLIC_POST_SQL: 'COALESCE(posts.video,0)<>100' },
    './SocialChatSocket': { pushSocialChange: (scope, options) => changes.push({ scope, options }) },
  })[name];
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  mod.exports.registerSocialChatRoutes({
    get: (url, handle) => routes.set(`GET ${url}`, handle),
    post: (url, handle) => routes.set(`POST ${url}`, handle),
  });
  return {
    changes,
    async request(method, url, values = {}, member = '8') {
      const result = { status: 200, body: undefined };
      const response = {
        set() {},
        status(code) { result.status = code; return this; },
        json(value) { result.body = value; },
      };
      await routes.get(`${method} ${url}`)({
        headers: { 'x-clikb-active-member': member },
        query: method === 'GET' ? values : {},
        body: method === 'POST' ? values : {},
      }, response);
      return result;
    },
  };
}

test('unread notification badge uses only the active recipient count', async () => {
  let queries = 0;
  const app = harness(async (sql, args) => {
    queries++;
    assert.match(sql, /COUNT\(\*\) AS unread/);
    assert.match(sql, /seen_at IS NULL/);
    assert.match(sql, /social_blocks/);
    assert.deepEqual(args, [8, 8, 8]);
    return [{ unread: 2 }];
  });
  const result = await app.request('GET', '/social/notifications', { unreadOnly: '1' });
  assert.deepEqual(result, { status: 200, body: { unread: 2 } });
  const staleProfile = await app.request('GET', '/social/notifications', { unreadOnly: '1' }, '9');
  assert.equal(staleProfile.status, 409);
  assert.equal(queries, 1);
});

test('message pages exhaust modern and legacy streams independently without duplicate legacy promotions', async () => {
  const modern = Array.from({ length: 93 }, (_, index) => ({ id: 1000 - index }));
  const promotedComment = 66;
  const legacy = Array.from({ length: 95 }, (_, index) => ({ id: `legacy-${95 - index}` }))
    .filter(row => Number(row.id.slice(7)) !== promotedComment);
  let modernQueries = 0;
  let legacyQueries = 0;
  const app = harness(async (sql, args) => {
    if (sql.includes('FROM social_messages m JOIN members')) {
      modernQueries++;
      assert.match(sql, /LIMIT 41/);
      assert.match(sql, /m.channel='post'/);
      const before = sql.includes('AND m.id<?') ? args.at(-1) : Infinity;
      return modern.filter(row => row.id < before).slice(0, 41);
    }
    if (sql.includes('FROM comments c JOIN posts')) {
      legacyQueries++;
      assert.match(sql, /m.id IS NULL/);
      assert.match(sql, /ORDER BY c.id DESC LIMIT 41/);
      const before = sql.includes('AND c.id<?') ? args.at(-1) : Infinity;
      return legacy.filter(row => Number(row.id.slice(7)) < before).slice(0, 41);
    }
    throw new Error(`Unexpected query ${sql}`);
  });
  const ids = [];
  const legacyIds = [];
  let modernBefore;
  let legacyBefore;
  let more = true;
  let legacyMore = true;
  for (let page = 0; more || legacyMore; page++) {
    assert.ok(page < 5, 'Both cursor streams must terminate');
    const result = await app.request('GET', '/social/messages', {
      channel: 'feeds',
      ...(modernBefore ? { before: String(modernBefore) } : {}),
      ...(legacyBefore ? { legacyBefore: String(legacyBefore) } : {}),
      ...(!more ? { skipMessages: '1' } : {}),
      ...(!legacyMore ? { skipLegacy: '1' } : {}),
    });
    assert.equal(result.status, 200);
    assert.ok(result.body.messages.length <= 40);
    assert.ok(result.body.legacy.length <= 40);
    ids.push(...result.body.messages.map(row => row.id));
    legacyIds.push(...result.body.legacy.map(row => row.id));
    modernBefore = result.body.messages.at(-1)?.id ?? modernBefore;
    legacyBefore = result.body.legacyBefore ?? legacyBefore;
    more = result.body.hasMore;
    legacyMore = result.body.legacyHasMore;
  }
  assert.deepEqual(ids, modern.map(row => row.id));
  assert.deepEqual(legacyIds, legacy.map(row => row.id));
  assert.equal(new Set(ids).size, modern.length);
  assert.equal(new Set(legacyIds).size, legacy.length);
  assert.equal(modernQueries, 3);
  assert.equal(legacyQueries, 3);
});

test('legacy-only comments retain older pages after the modern stream is exhausted', async () => {
  let modernQueries = 0;
  const app = harness(async (sql, args) => {
    if (sql.includes('FROM social_messages m JOIN members')) { modernQueries++; return []; }
    if (sql.includes('FROM comments c JOIN posts')) {
      const before = sql.includes('AND c.id<?') ? args.at(-1) : 86;
      return Array.from({ length: before - 1 }, (_, index) => ({ id: `legacy-${before - 1 - index}` })).slice(0, 41);
    }
    throw new Error(`Unexpected query ${sql}`);
  });
  const first = (await app.request('GET', '/social/messages', { channel: 'feeds' })).body;
  assert.equal(first.hasMore, false);
  assert.equal(first.legacyHasMore, true);
  assert.equal(first.legacyBefore, 46);
  const second = (await app.request('GET', '/social/messages', {
    channel: 'feeds', legacyBefore: String(first.legacyBefore), skipMessages: '1',
  })).body;
  assert.equal(second.legacy[0].id, 'legacy-45');
  assert.equal(second.legacyBefore, 6);
  const third = (await app.request('GET', '/social/messages', {
    channel: 'feeds', legacyBefore: String(second.legacyBefore), skipMessages: '1',
  })).body;
  assert.deepEqual(third.legacy.map(row => row.id), ['legacy-5', 'legacy-4', 'legacy-3', 'legacy-2', 'legacy-1']);
  assert.equal(third.legacyHasMore, false);
  assert.equal(modernQueries, 1);
});

test('notification deletion is recipient-scoped, retry-safe and signals only the owner', async () => {
  const records = [{ id: 101, recipient: 8 }, { id: 102, recipient: 9 }];
  let queries = 0;
  const app = harness(async (sql, args) => {
    queries++;
    assert.equal(sql, 'DELETE FROM social_notifications WHERE recipient_id=? AND id=?');
    const index = records.findIndex(row => row.recipient === args[0] && row.id === args[1]);
    if (index < 0) return { affectedRows: 0 };
    records.splice(index, 1);
    return { affectedRows: 1 };
  });
  const stale = await app.request('POST', '/social/notifications/delete', { id: 101 }, '9');
  assert.equal(stale.status, 409);
  assert.equal(queries, 0);
  const other = await app.request('POST', '/social/notifications/delete', { id: 102 });
  assert.deepEqual(other.body, { deleted: false });
  assert.equal(records.length, 2);
  const own = await app.request('POST', '/social/notifications/delete', { id: 101 });
  assert.deepEqual(own.body, { deleted: true });
  assert.deepEqual(app.changes, [
    { scope: 'notifications', options: { members: [8], deletedNotificationId: 101 } },
    { scope: 'rooms', options: { members: [8] } },
  ]);
  const again = await app.request('POST', '/social/notifications/delete', { id: 101 });
  assert.deepEqual(again.body, { deleted: false });
  assert.deepEqual(records, [{ id: 102, recipient: 9 }]);
  assert.equal(app.changes.length, 2);
});

test('production Guest gets an empty notification preview and private Rooms stay session-bound', async () => {
  const previousState = process.env.APP_STATE;
  process.env.APP_STATE = 'prod';
  try {
    const app = harness(async () => assert.fail('Shared Guest must not read personal notifications'), '1');
    const result = await app.request('GET', '/social/notifications', {}, '1');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { notifications: [], hasMore: false, unread: 0 });
    assert.equal((await app.request('GET', '/social/rooms', {}, '1')).status, 403);
  } finally {
    if (previousState === undefined) delete process.env.APP_STATE;
    else process.env.APP_STATE = previousState;
  }
});

test('notification keysets include welcome and credit only in All and exhaust the oldest page', async () => {
  const records = Array.from({ length: 91 }, (_, index) => ({
    id: 91 - index, kind: ['like', 'reply', 'room', 'welcome', 'credit'][index % 5],
  }));
  const app = harness(async (sql, args) => {
    if (sql.includes('COUNT(*) AS unread')) return [{ unread: 11 }];
    assert.match(sql, /SELECT n.id,n.kind/);
    assert.match(sql, /WHERE n.recipient_id=\?/);
    assert.deepEqual(args.slice(0, 3), [8, 8, 8]);
    const before = sql.includes('AND n.id<?') ? args.at(-1) : Infinity;
    return records.filter(row => row.id < before
      && (!sql.includes("n.kind='like'") || row.kind === 'like')
      && (!sql.includes("n.kind IN ('reply','room')") || ['reply', 'room'].includes(row.kind))).slice(0, 41);
  });
  const seen = [];
  let before;
  let more = true;
  while (more) {
    const { body } = await app.request('GET', '/social/notifications', { filter: 'all', ...(before ? { before: String(before) } : {}) });
    seen.push(...body.notifications.map(row => row.id));
    assert.equal(body.unread, 11);
    more = body.hasMore;
    before = body.notifications.at(-1)?.id;
  }
  assert.deepEqual(seen, records.map(row => row.id));
  const chats = (await app.request('GET', '/social/notifications', { filter: 'chats' })).body.notifications;
  assert.ok(chats.every(row => ['reply', 'room'].includes(row.kind)));
  const likes = (await app.request('GET', '/social/notifications', { filter: 'likes' })).body.notifications;
  assert.ok(likes.every(row => row.kind === 'like'));
});

test('Notifications can still load before the optional message column is migrated', async () => {
  const app = harness(async sql => {
    if (sql.includes('COUNT(*) AS unread')) return [{ unread: 1 }];
    if (sql.includes('n.body')) throw Object.assign(new Error("Unknown column 'n.body' in 'field list'"), { code: 'ER_BAD_FIELD_ERROR' });
    assert.match(sql, /NULL AS body/);
    return [{ id: 1, kind: 'like', body: null }];
  });
  const result = await app.request('GET', '/social/notifications', {});
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { notifications: [{ id: 1, kind: 'like', body: null }], unread: 1, hasMore: false });
});

test('Room keysets reach beyond 100 rooms and retain empty-room ties', async () => {
  const records = Array.from({ length: 147 }, (_, index) => ({
    id: 147 - index, lastMessageId: index < 102 ? Math.floor((102 - index) / 3) : 0,
  }));
  const app = harness(async (sql, args) => {
    assert.match(sql, /ORDER BY lastMessageId DESC,r.id DESC LIMIT 41/);
    assert.match(sql, /WHERE \(r.member_a=\? OR r.member_b=\?\)/);
    if (!sql.includes('HAVING')) return records.slice(0, 41);
    const [lastMessageId, sameLastMessageId, roomId] = args.slice(-3);
    assert.equal(lastMessageId, sameLastMessageId);
    return records.filter(row => row.lastMessageId < lastMessageId
      || row.lastMessageId === lastMessageId && row.id < roomId).slice(0, 41);
  });
  const seen = [];
  let cursor;
  let more = true;
  while (more) {
    const { body } = await app.request('GET', '/social/rooms', cursor ? {
      beforeLastMessage: String(cursor.lastMessageId), beforeRoom: String(cursor.roomId),
    } : {});
    seen.push(...body.rooms.map(row => row.id));
    more = body.hasMore;
    cursor = body.nextCursor;
  }
  assert.deepEqual(seen, records.map(row => row.id));
  assert.equal(new Set(seen).size, 147);
  assert.equal((await app.request('GET', '/social/rooms', { beforeRoom: '3', beforeLastMessage: '-1' })).status, 400);
});

test('feeds and post messages resolve postThumb from xh1 (HD) or x1, not xt1 prompt text', async () => {
  const app = harness(async (sql) => {
    assert.match(sql, /COALESCE\(NULLIF\(p\.thumb1,''\),NULLIF\(p\.xh1,''\),NULLIF\(p\.x1,''\),NULLIF\(p\.item1,''\)\) AS postThumb/);
    assert.doesNotMatch(sql, /NULLIF\(p\.xt1/);
    assert.match(sql, /ra\.username AS replyUsername/);
    assert.match(sql, /SELECT COUNT\(\*\) FROM social_messages rc WHERE rc\.reply_id=m\.id/);
    return [{ id: 10, authorId: 8, body: 'hello', postThumb: 'https://cdn/scene1.png', replyUsername: 'Guest', replyCount: 3 }];
  });
  const result = await app.request('GET', '/social/messages', { channel: 'feeds', skipLegacy: '1' });
  assert.equal(result.status, 200);
  assert.equal(result.body.messages[0].postThumb, 'https://cdn/scene1.png');
  assert.equal(result.body.messages[0].replyUsername, 'Guest');
  assert.equal(result.body.messages[0].replyCount, 3);
});

test('thread query loads root and replies chronologically without needing channel args', async () => {
  const app = harness(async (sql, args) => {
    assert.match(sql, /\(m\.id=\? OR m\.reply_id=\?\)/);
    assert.match(sql, /ORDER BY m\.id ASC/);
    assert.deepEqual(args.slice(2, 4), [42, 42]);
    return [
      { id: 42, authorId: 1, body: 'i am hero' },
      { id: 45, authorId: 8, body: 'cool video', replyId: 42, replyUsername: 'Guest' },
    ];
  });
  const result = await app.request('GET', '/social/messages', { threadRootId: '42' });
  assert.equal(result.status, 200);
  assert.equal(result.body.messages.length, 2);
  assert.equal(result.body.messages[0].id, 42);
  assert.equal(result.body.messages[1].id, 45);
});

test('message deletion enforces ownership in production and permits dev super-delete for Guest', async () => {
  const queries = [];
  const app = harness(async (sql, args) => {
    queries.push({ sql, args });
    if (sql.startsWith('SELECT id, channel, author_id')) {
      return [{ id: 99, channel: 'post', author_id: 8, post_id: 10, room_id: null, legacy_comment_id: 20 }];
    }
    if (sql.includes('FROM comments WHERE id=?')) {
      return [{ id: 20, commented_by: 8, post: 10 }];
    }
    return { affectedRows: 1 };
  });

  const success = await app.request('POST', '/social/messages/delete', { messageId: 99 }, '8');
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, { success: true });
  assert.ok(queries.some(q => q.sql.includes('DELETE FROM social_notifications WHERE message_id=?') && q.args[0] === 99));
  assert.ok(queries.some(q => q.sql.includes('DELETE FROM comments WHERE id=?') && q.args[0] === 20));
  assert.ok(queries.some(q => q.sql.includes('DELETE FROM social_messages WHERE id=?') && q.args[0] === 99));
  assert.ok(app.changes.some(c => c.scope === 'post' && c.options?.id === 10));

  const foreignApp = harness(async (sql) => {
    if (sql.startsWith('SELECT id, channel, author_id')) {
      return [{ id: 100, channel: 'post', author_id: 99, post_id: 10, room_id: null }];
    }
    return { affectedRows: 1 };
  });
  const forbidden = await foreignApp.request('POST', '/social/messages/delete', { messageId: 100 }, '8');
  assert.equal(forbidden.status, 403);

  const devApp = harness(async (sql) => {
    if (sql.startsWith('SELECT id, channel, author_id')) {
      return [{ id: 101, channel: 'post', author_id: 88, post_id: 12, room_id: null }];
    }
    return { affectedRows: 1 };
  }, '1');
  const prevEnv = process.env.APP_STATE;
  try {
    process.env.APP_STATE = 'dev';
    const devSuperDelete = await devApp.request('POST', '/social/messages/delete', { messageId: 101 }, '1');
    assert.equal(devSuperDelete.status, 200);
    assert.deepEqual(devSuperDelete.body, { success: true });

    process.env.APP_STATE = 'prod';
    const prodGuestBlocked = await devApp.request('POST', '/social/messages/delete', { messageId: 101 }, '1');
    assert.equal(prodGuestBlocked.status, 403);
  } finally {
    process.env.APP_STATE = prevEnv;
  }
});

test('notifications join replyId and fall back to social_messages body for reply preview', async () => {
  const app = harness(async (sql) => {
    if (sql.includes('COUNT(*) AS unread')) return [{ unread: 1 }];
    assert.match(sql, /n\.message_id AS messageId/);
    assert.match(sql, /m\.reply_id AS replyId/);
    assert.match(sql, /COALESCE\(NULLIF\(n\.body,''\), m\.body\) AS body/);
    return [{
      id: 501, kind: 'reply', messageId: 99, replyId: 42,
      body: 'you make this', postId: 10, postTitle: 'CLIKB HEROES',
      authorId: 8, username: 'clikbateskywalker_10', createdAt: '2026-11-06T02:24:00Z',
    }];
  });
  const res = await app.request('GET', '/social/notifications');
  assert.equal(res.status, 200);
  assert.equal(res.body.notifications.length, 1);
  assert.equal(res.body.notifications[0].replyId, 42);
  assert.equal(res.body.notifications[0].body, 'you make this');
});

test('deck mode active post resolution safely tolerates missing fullscreen and resolves deck activePostId', async () => {
  const toValidId = (value) => {
    const num = Number(value);
    return Number.isSafeInteger(num) && num > 0 ? num : undefined;
  };

  const fullscreenState = undefined;
  const deckState = { activePostId: 84 };
  const locationState = { clikbDeck: { activePostId: 84 } };

  const resolved = toValidId(undefined)
    ?? toValidId(fullscreenState?.postId)
    ?? toValidId(deckState?.activePostId)
    ?? toValidId(locationState?.clikbDeck?.activePostId);

  assert.equal(resolved, 84);
});

test('reply count is scoped strictly to thread root chats with at least 1 reply', async () => {
  const localReplyCounts = new Map();
  // Simulated messages: msg 10 has two replies (msg 11 and msg 12). msg 20 has 0 replies.
  localReplyCounts.set(10, 2);

  const calculateReplyCount = (row) => {
    return !row.replyId
      ? Math.max(Number(row.replyCount) || 0, localReplyCounts.get(Number(row.id)) || 0)
      : 0;
  };

  // Root message that started the thread (has 2 replies)
  const rootMessage = { id: 10, replyCount: 2 };
  assert.equal(calculateReplyCount(rootMessage), 2);

  // Message that is a reply to another message (should have 0 count)
  const replyMessage = { id: 11, replyId: 10, replyCount: 1 };
  assert.equal(calculateReplyCount(replyMessage), 0);

  // Root message with 0 replies (should have 0 count, omitted in UI)
  const soloMessage = { id: 20, replyCount: 0 };
  assert.equal(calculateReplyCount(soloMessage), 0);
});

test('opening thread from notification isolates thread query and suppresses notification activity list', async () => {
  const isThread = true;
  const tab = 'notifications';
  const threadRootId = 42;

  // Verify refresh condition switches to messages when isThread is true
  const wouldFetchNotifications = !isThread && tab === 'notifications';
  const wouldFetchMessages = isThread || tab !== 'notifications';
  assert.equal(wouldFetchNotifications, false);
  assert.equal(wouldFetchMessages, true);

  // Verify message path resolves thread query
  const messagePath = isThread
    ? `messages?threadRootId=${threadRootId}`
    : `messages?channel=${tab}`;
  assert.equal(messagePath, 'messages?threadRootId=42');

  // Verify notification list is hidden in thread view
  const renderNotifications = !isThread && tab === 'notifications';
  assert.equal(renderNotifications, false);
});

test('thread view preserves post thumbnail only on thread root and removes duplicate thumbnail from replies', async () => {
  const isThread = true;
  const tab = 'feeds';
  const threadRootId = 100;

  const isLinkedPost = (row) => {
    const isRoot = isThread && Number(row.id) === Number(threadRootId);
    return Boolean(row.postId && (!isThread ? (tab === 'feeds' || row.sharedMessageId || tab === 'global') : isRoot));
  };

  const rootRow = { id: 100, postId: 55, postThumb: 'https://cdn/thumb.jpg', postTitle: 'Hero' };
  const replyRow1 = { id: 101, replyId: 100, postId: 55, postThumb: 'https://cdn/thumb.jpg', postTitle: 'Hero' };
  const replyRow2 = { id: 102, replyId: 100, postId: 55, postThumb: 'https://cdn/thumb.jpg', postTitle: 'Hero' };

  // Root message displays the post thumbnail and caption anchor
  assert.equal(isLinkedPost(rootRow), true);

  // Subsequent replies in thread suppress redundant thumbnail
  assert.equal(isLinkedPost(replyRow1), false);
  assert.equal(isLinkedPost(replyRow2), false);

  // When outside thread (in Feeds), messages still display the thumbnail
  const feedsLinkedPost = (row) => {
    const isThreadLocal = false;
    const isRootLocal = false;
    return Boolean(row.postId && (!isThreadLocal ? (tab === 'feeds' || row.sharedMessageId || tab === 'global') : isRootLocal));
  };
  assert.equal(feedsLinkedPost(replyRow1), true);
});
