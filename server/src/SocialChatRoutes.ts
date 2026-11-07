import type { Express, Request, Response } from 'express';
import execQuery, { withTransaction, type TransactionQuery } from './execQuery';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { PUBLIC_POST_SQL } from './postPublication';
import { pushSocialChange } from './SocialChatSocket';

class SocialError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function id(value: unknown) {
  if (!/^\d+$/.test(String(value ?? ''))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function actor(req: Request, privateAccount = false) {
  const member = id(authenticatedUserId(req));
  const owner = id(authenticatedOwnerId(req));
  if (!member || !owner) throw new SocialError(401, 'Sign in to use Chat.');
  const expectedMember = req.headers?.['x-clikb-active-member'];
  if (expectedMember != null && id(expectedMember) !== member)
    throw new SocialError(409, 'Your active profile changed. Refresh before using Chat.');
  if (privateAccount && owner === 1 && process.env.APP_STATE !== 'dev')
    throw new SocialError(403, 'Sign in to use private Chat features.');
  return { member, owner };
}

const unavailable = (error: any) => error?.code === 'ER_NO_SUCH_TABLE';
const privateReply = (run: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    try { await run(req, res); }
    catch (error) {
      if (error instanceof SocialError) { res.status(error.status).json({ error: error.message }); return; }
      if (unavailable(error)) { res.status(503).json({ error: 'Chat is not available yet.' }); return; }
      console.error('Social request failed.');
      res.status(500).json({ error: 'Chat could not complete that request.' });
    }
  };

const blockFilter = (author: string) => `NOT EXISTS (SELECT 1 FROM social_blocks b
  WHERE (b.blocker_id = ? AND b.blocked_id = ${author}) OR (b.blocker_id = ${author} AND b.blocked_id = ?))`;
const visiblePost = `EXISTS (SELECT 1 FROM posts WHERE posts.id = m.post_id AND ${PUBLIC_POST_SQL})`;

async function assertPost(query: TransactionQuery, postId: number) {
  const [post] = await query(`SELECT sender FROM posts WHERE id=? AND ${PUBLIC_POST_SQL} LIMIT 1`, [postId]);
  if (!post) throw new SocialError(404, 'This post is unavailable.');
  return post;
}

async function assertCanInteract(query: TransactionQuery, member: number, peer: number) {
  const [blocked] = await query(`SELECT 1 FROM social_blocks
    WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1`, [member, peer, peer, member]);
  if (blocked) throw new SocialError(403, 'This interaction is unavailable.');
}

async function roomPeer(query: TransactionQuery, roomId: number, member: number) {
  const [room] = await query('SELECT member_a,member_b FROM social_rooms WHERE id=? AND (member_a=? OR member_b=?)', [roomId, member, member]);
  if (!room) throw new SocialError(404, 'Room not found.');
  return Number(room.member_a) === member ? Number(room.member_b) : Number(room.member_a);
}

async function rateLimit(query: TransactionQuery, owner: number) {
  await query('INSERT IGNORE INTO social_write_limits (owner_id) VALUES (?)', [owner]);
  const [result] = await query(`SELECT writes, TIMESTAMPDIFF(SECOND, window_start, CURRENT_TIMESTAMP) >= 60 AS reset_window
    FROM social_write_limits WHERE owner_id=? FOR UPDATE`, [owner]);
  if (!Number(result.reset_window) && Number(result.writes) >= 18) throw new SocialError(429, 'Wait a moment before posting again.');
  await query(Number(result.reset_window)
    ? 'UPDATE social_write_limits SET window_start=CURRENT_TIMESTAMP,writes=1 WHERE owner_id=?'
    : 'UPDATE social_write_limits SET writes=writes+1 WHERE owner_id=?', [owner]);
}

async function notify(query: TransactionQuery, input: {
  recipient: number; member: number; kind: 'like' | 'reply' | 'room'; post?: number | null;
  message?: number; room?: number | null; key: string;
}) {
  if (input.recipient === input.member || (input.recipient === 1 && process.env.APP_STATE !== 'dev')) return;
  await query(`INSERT IGNORE INTO social_notifications
    (recipient_id,actor_id,kind,post_id,message_id,room_id,event_key) VALUES (?,?,?,?,?,?,?)`,
  [input.recipient, input.member, input.kind, input.post ?? null, input.message ?? null, input.room ?? null, input.key]);
}

export async function publishPostLike(query: TransactionQuery, post: number, member: number, recipient: number, liked: boolean) {
  try {
    const key = `like:${post}:${member}`;
    if (liked) await notify(query, { recipient, member, kind: 'like', post, key });
    else await query('DELETE FROM social_notifications WHERE event_key=?', [key]);
  } catch (error) { if (!unavailable(error)) throw error; }
}

type Channel = 'global' | 'feeds' | 'post' | 'room';
function channel(value: unknown): Channel {
  if (value === 'global' || value === 'feeds' || value === 'post' || value === 'room') return value;
  throw new SocialError(400, 'Choose a conversation.');
}

async function findPostMessage(query: TransactionQuery, messageId: number) {
  const [msg] = await query(`SELECT m.id,m.author_id,m.post_id FROM social_messages m
    WHERE m.id=? AND m.channel='post' AND ${visiblePost}`, [messageId]);
  return msg;
}

async function resolveMessageId(query: TransactionQuery, value: unknown): Promise<number | null> {
  if (value == null) return null;
  const current = id(value);
  if (current) return current;
  const legacy = typeof value === 'string' && value.startsWith('legacy-') ? id(value.slice(7)) : null;
  if (!legacy) throw new SocialError(400, 'Choose a valid message.');
  const [comment] = await query(`SELECT c.id,c.post,c.com,c.commented_by,c.date
    FROM comments c JOIN posts ON posts.id=c.post WHERE c.id=? AND ${PUBLIC_POST_SQL}`, [legacy]);
  if (!comment) throw new SocialError(404, 'This comment is unavailable.');
  await query(`INSERT IGNORE INTO social_messages
    (channel,author_id,post_id,legacy_comment_id,body,created_at)
    VALUES ('post',?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))`,
  [comment.commented_by, comment.post, legacy, String(comment.com ?? '').slice(0, 2000), comment.date]);
  const [stored] = await query('SELECT id FROM social_messages WHERE legacy_comment_id=?', [legacy]);
  return Number(stored.id);
}

export function registerSocialChatRoutes(app: Express) {
  app.get('/social/post-activity', privateReply(async (req, res) => {
    const { member } = actor(req);
    const postId = id(req.query.postId);
    if (!postId) throw new SocialError(400, 'Choose a post.');
    const [post] = await execQuery(`SELECT (
      EXISTS (SELECT 1 FROM social_messages m WHERE m.post_id=posts.id
        AND m.channel='post' AND ${blockFilter('m.author_id')})
      OR EXISTS (SELECT 1 FROM comments c WHERE c.post=posts.id AND ${blockFilter('c.commented_by')})
      ) AS hasMessages FROM posts WHERE posts.id=? AND ${PUBLIC_POST_SQL} LIMIT 1`,
    [member, member, member, member, postId]);
    res.json({ hasMessages: Boolean(Number(post?.hasMessages)) });
  }));

  app.get('/social/messages', privateReply(async (req, res) => {
    const threadRoot = id(req.query.threadRootId);
    const kind = req.query.channel ? channel(req.query.channel) : threadRoot ? 'post' : channel(req.query.channel);
    const { member } = actor(req, kind === 'room');
    const postId = id(req.query.postId);
    const roomId = id(req.query.roomId);
    const before = id(req.query.before);
    const after = before ? null : id(req.query.after);
    const legacyBefore = id(req.query.legacyBefore);
    if (!threadRoot && (kind === 'post' && !postId || kind === 'room' && !roomId)) throw new SocialError(400, 'Choose a conversation.');
    if (kind === 'post' && postId) await assertPost(execQuery, postId);
    if (kind === 'room' && roomId) await assertCanInteract(execQuery, member, await roomPeer(execQuery, roomId, member));
    const scope = threadRoot ? '(m.id=? OR m.reply_id=?)' :
      kind === 'room' ? "m.channel='room' AND m.room_id=?" :
        kind === 'post' ? "m.channel='post' AND m.post_id=?" :
          kind === 'feeds' ? `m.channel='post' AND ${visiblePost}` : "m.channel='global'";
    const params = threadRoot ? [threadRoot, threadRoot] :
      kind === 'room' ? [roomId] : kind === 'post' ? [postId] : [];
    const sort = after || threadRoot ? 'ASC' : 'DESC';
    const rows = req.query.skipMessages === '1' ? [] : await execQuery(`SELECT m.id,m.author_id AS authorId,
      CASE WHEN p.id IS NOT NULL THEN m.post_id ELSE NULL END AS postId,
      m.room_id AS roomId,m.reply_id AS replyId,m.shared_message_id AS sharedMessageId,m.legacy_comment_id AS legacyCommentId,
      m.body,m.created_at AS createdAt,a.username,a.profile_image AS avatar,p.caption AS postTitle,s.body AS sharedBody,
      ra.username AS replyUsername,
      (SELECT COUNT(*) FROM social_messages rc WHERE rc.reply_id=m.id) AS replyCount,
      COALESCE(NULLIF(p.thumb1,''),NULLIF(p.xh1,''),NULLIF(p.x1,''),NULLIF(p.item1,'')) AS postThumb
      FROM social_messages m JOIN members a ON a.id=m.author_id
      LEFT JOIN posts p ON p.id=m.post_id AND COALESCE(p.video,0) <> 100
      LEFT JOIN social_messages s ON s.id=m.shared_message_id AND s.channel='post'
        AND p.id IS NOT NULL AND ${blockFilter('s.author_id')}
      LEFT JOIN social_messages r ON r.id=m.reply_id
      LEFT JOIN members ra ON ra.id=r.author_id
      WHERE ${scope} AND ${blockFilter('m.author_id')}
      ${before ? 'AND m.id<?' : after ? 'AND m.id>?' : ''} ORDER BY m.id ${sort} LIMIT 41`,
    [member, member, ...params, member, member, ...(before || after ? [before || after] : [])]);
    const legacy = !threadRoot && req.query.skipLegacy !== '1' && !after && (kind === 'post' || kind === 'feeds') ? await execQuery(`
      SELECT CONCAT('legacy-', c.id) AS id,c.com AS body,c.commented_by AS authorId,c.post AS postId,
        c.date AS createdAt,a.username,a.profile_image AS avatar,posts.caption AS postTitle,NULL AS replyUsername,
        0 AS replyCount,
        COALESCE(NULLIF(posts.thumb1,''),NULLIF(posts.xh1,''),NULLIF(posts.x1,''),NULLIF(posts.item1,'')) AS postThumb
      FROM comments c JOIN posts ON posts.id=c.post JOIN members a ON a.id=c.commented_by
      LEFT JOIN social_messages m ON m.legacy_comment_id=c.id
      WHERE m.id IS NULL AND ${PUBLIC_POST_SQL} AND ${blockFilter('c.commented_by')}
      ${kind === 'post' ? 'AND c.post=?' : ''} ${legacyBefore ? 'AND c.id<?' : ''} ORDER BY c.id DESC LIMIT 41`,
    [member, member, ...(kind === 'post' ? [postId] : []), ...(legacyBefore ? [legacyBefore] : [])]) : [];
    const legacyPage = legacy.slice(0, 40);
    res.json({ messages: rows.slice(0, 40), legacy: legacyPage, hasMore: rows.length > 40,
      legacyHasMore: legacy.length > 40, legacyBefore: legacyPage.length ? Number(String(legacyPage.at(-1).id).slice(7)) : null });
  }));

  app.post('/social/messages', privateReply(async (req, res) => {
    const { member, owner } = actor(req, req.body?.channel === 'room');
    const kind = channel(req.body?.channel);
    const post = id(req.body?.postId);
    const room = id(req.body?.roomId);
    const replyTarget = req.body?.replyId;
    const shareTarget = req.body?.sharedMessageId;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (kind === 'feeds' || kind === 'post' && !post || kind === 'room' && !room ||
        shareTarget != null && kind !== 'global' || (!body && shareTarget == null) || body.length > 2000)
      throw new SocialError(400, 'Enter a message of up to 2,000 characters.');
    const committed = await withTransaction(async query => {
      await rateLimit(query, owner);
      const peer = room && kind === 'room' ? await roomPeer(query, room, member) : null;
      if (peer) await assertCanInteract(query, member, peer);
      if (post && kind === 'post') await assertCanInteract(query, member, Number((await assertPost(query, post)).sender));
      const reply = await resolveMessageId(query, replyTarget);
      const shared = await resolveMessageId(query, shareTarget);
      const source = shared ? await findPostMessage(query, shared) : null;
      if (shared && !source) throw new SocialError(404, 'The source comment is unavailable.');
      if (source) await assertCanInteract(query, member, Number(source.author_id));
      let parent: any;
      if (reply) {
        [parent] = await query('SELECT channel,author_id,post_id,room_id FROM social_messages WHERE id=?', [reply]);
        if (!parent || parent.channel !== kind || kind === 'post' && Number(parent.post_id) !== post ||
            kind === 'room' && Number(parent.room_id) !== room) throw new SocialError(404, 'Reply target is unavailable.');
        await assertCanInteract(query, member, Number(parent.author_id));
      }
      let legacy = null;
      if (kind === 'post') {
        const result = await query('INSERT INTO comments (post,com,commented_by,date) VALUES (?,?,?,NOW())', [post, body, member]);
        legacy = result.insertId;
      }
      const sourcePost = kind === 'post' ? post : id(source?.post_id ?? parent?.post_id);
      const result = await query(`INSERT INTO social_messages
        (channel,author_id,post_id,room_id,reply_id,shared_message_id,legacy_comment_id,body) VALUES (?,?,?,?,?,?,?,?)`,
      [kind, member, sourcePost, kind === 'room' ? room : null, reply, shared, legacy, body]);
      const message = Number(result.insertId);
      if (peer) await notify(query, { recipient: peer, member, kind: 'room', message, room, key: `room:${message}` });
      else if (parent) await notify(query, { recipient: Number(parent.author_id), member, kind: 'reply',
        message, post: sourcePost, key: `reply:${message}` });
      return { message, peer, recipient: peer || Number(parent?.author_id) || null };
    });
    if (kind === 'room' && committed.peer) {
      const members = [member, committed.peer];
      pushSocialChange('room', { id: room!, members });
      pushSocialChange('rooms', { members });
    } else if (kind === 'post') pushSocialChange('post', { id: post! });
    else if (kind === 'global') pushSocialChange('global');
    if (committed.recipient) pushSocialChange('notifications', { members: [committed.recipient] });
    res.status(201).json({ id: committed.message });
  }));

  app.post('/social/messages/delete', privateReply(async (req, res) => {
    const { member } = actor(req);
    const targetId = req.body?.messageId;
    const legacyId = typeof targetId === 'string' && targetId.startsWith('legacy-') ? id(targetId.slice(7)) : null;
    const messageId = id(targetId);

    if (!messageId && !legacyId) throw new SocialError(400, 'Choose a message to delete.');

    const isDevAdmin = member === 1 && process.env.APP_STATE === 'dev';

    const committed = await withTransaction(async query => {
      let msg: any = null;
      let commentId: number | null = legacyId;

      if (messageId) {
        [msg] = await query('SELECT id, channel, author_id, post_id, room_id, legacy_comment_id FROM social_messages WHERE id=?', [messageId]);
      } else if (legacyId) {
        [msg] = await query('SELECT id, channel, author_id, post_id, room_id, legacy_comment_id FROM social_messages WHERE legacy_comment_id=?', [legacyId]);
      }

      if (msg) {
        if (!isDevAdmin && Number(msg.author_id) !== member) {
          throw new SocialError(403, 'You can only delete your own messages.');
        }
        commentId = msg.legacy_comment_id ? Number(msg.legacy_comment_id) : commentId;
        await query('DELETE FROM social_notifications WHERE message_id=?', [msg.id]);
        await query('DELETE FROM social_reports WHERE message_id=?', [msg.id]);
        await query('UPDATE social_messages SET shared_message_id=NULL WHERE shared_message_id=?', [msg.id]);
        await query('UPDATE social_messages SET reply_id=NULL WHERE reply_id=?', [msg.id]);
        await query('DELETE FROM social_messages WHERE id=?', [msg.id]);
      }

      if (commentId) {
        const [comment] = await query('SELECT id, commented_by, post FROM comments WHERE id=?', [commentId]);
        if (comment) {
          if (!isDevAdmin && Number(comment.commented_by) !== member) {
            throw new SocialError(403, 'You can only delete your own messages.');
          }
          await query('DELETE FROM comments WHERE id=?', [commentId]);
        }
      }

      if (!msg && !commentId) {
        throw new SocialError(404, 'Message not found.');
      }

      let peer: number | null = null;
      if (msg?.channel === 'room' && msg?.room_id) {
        try {
          peer = await roomPeer(query, Number(msg.room_id), member);
        } catch {
          peer = null;
        }
      }

      return {
        channel: msg?.channel || 'post',
        postId: msg?.post_id ? Number(msg.post_id) : null,
        roomId: msg?.room_id ? Number(msg.room_id) : null,
        peer,
      };
    });

    if (committed.channel === 'room' && committed.roomId) {
      const members = committed.peer ? [member, committed.peer] : [member];
      pushSocialChange('room', { id: committed.roomId, members });
      pushSocialChange('rooms', { members });
    } else if (committed.channel === 'post' && committed.postId) {
      pushSocialChange('post', { id: committed.postId });
      pushSocialChange('feeds');
    } else if (committed.channel === 'global') {
      pushSocialChange('global');
    } else {
      pushSocialChange('feeds');
    }

    res.json({ success: true });
  }));

  app.get('/social/notifications', privateReply(async (req, res) => {
    const { member, owner } = actor(req);
    if (owner === 1 && process.env.APP_STATE !== 'dev') {
      res.json({ notifications: [], hasMore: false, unread: 0 });
      return;
    }
    const countUnread = async () => {
      const [count] = await execQuery(`SELECT COUNT(*) AS unread FROM social_notifications n
        WHERE n.recipient_id=? AND n.seen_at IS NULL AND ${blockFilter('n.actor_id')}
        AND (n.post_id IS NULL OR EXISTS (SELECT 1 FROM posts WHERE id=n.post_id AND ${PUBLIC_POST_SQL}))`, [member, member, member]);
      return Number(count?.unread || 0);
    };
    if (req.query.unreadOnly === '1') {
      res.json({ unread: await countUnread() });
      return;
    }
    const before = id(req.query.before);
    const kind = req.query.filter === 'likes' ? "AND n.kind='like'" : req.query.filter === 'chats' ? "AND n.kind IN ('reply','room')" : '';
    const readPage = (includeBody: boolean) => execQuery(`SELECT n.id,n.kind,n.message_id AS messageId,m.reply_id AS replyId,
      ${includeBody ? "COALESCE(NULLIF(n.body,''), m.body) AS body" : 'NULL AS body'},
      n.post_id AS postId,n.room_id AS roomId,n.seen_at AS seenAt,
      n.created_at AS createdAt,n.actor_id AS authorId,a.username,a.profile_image AS avatar,p.caption AS postTitle
      FROM social_notifications n JOIN members a ON a.id=n.actor_id
      LEFT JOIN social_messages m ON m.id=n.message_id
      LEFT JOIN posts p ON p.id=n.post_id AND COALESCE(p.video,0) <> 100
      WHERE n.recipient_id=? AND ${blockFilter('n.actor_id')} AND (n.post_id IS NULL OR p.id IS NOT NULL)
      ${kind} ${before ? 'AND n.id<?' : ''} ORDER BY n.id DESC LIMIT 41`, [member, member, member, ...(before ? [before] : [])]);
    const rows = await readPage(true).catch((error: any) => {
      if (error?.code === 'ER_BAD_FIELD_ERROR' && String(error.message).includes('n.body')) return readPage(false);
      throw error;
    });
    res.json({ notifications: rows.slice(0, 40), hasMore: rows.length > 40, unread: await countUnread() });
  }));

  app.post('/social/notifications/read', privateReply(async (req, res) => {
    const { member } = actor(req, true);
    const notification = id(req.body?.id);
    const room = id(req.body?.roomId);
    if (!notification && !room) throw new SocialError(400, 'Choose a notification or room.');
    const result = await execQuery(`UPDATE social_notifications SET seen_at=CURRENT_TIMESTAMP
      WHERE recipient_id=? AND seen_at IS NULL AND ${notification ? 'id' : 'room_id'}=?`, [member, notification ?? room]);
    if (result.affectedRows) {
      pushSocialChange('notifications', { members: [member] });
      pushSocialChange('rooms', { members: [member] });
    }
    res.json({ ok: true });
  }));

  app.post('/social/notifications/delete', privateReply(async (req, res) => {
    const { member } = actor(req, true);
    const notification = id(req.body?.id);
    if (!notification) throw new SocialError(400, 'Choose a notification.');
    const result = await execQuery('DELETE FROM social_notifications WHERE recipient_id=? AND id=?', [member, notification]);
    if (result.affectedRows) {
      pushSocialChange('notifications', { members: [member], deletedNotificationId: notification });
      pushSocialChange('rooms', { members: [member] });
    }
    res.json({ deleted: result.affectedRows > 0 });
  }));

  app.get('/social/rooms', privateReply(async (req, res) => {
    const { member } = actor(req, true);
    const beforeRoom = id(req.query.beforeRoom);
    const beforeLastMessage = Number(req.query.beforeLastMessage);
    if (beforeRoom && (!Number.isSafeInteger(beforeLastMessage) || beforeLastMessage < 0))
      throw new SocialError(400, 'Choose a valid room page.');
    const rows = await execQuery(`SELECT r.id,a.id AS authorId,a.username,a.profile_image AS avatar,
      COALESCE((SELECT MAX(m.id) FROM social_messages m WHERE m.room_id=r.id),0) AS lastMessageId,
      (SELECT COUNT(*) FROM social_notifications n WHERE n.recipient_id=? AND n.room_id=r.id AND n.seen_at IS NULL) AS unread
      FROM social_rooms r JOIN members a ON a.id=IF(r.member_a=?,r.member_b,r.member_a)
      WHERE (r.member_a=? OR r.member_b=?) AND ${blockFilter('a.id')}
      ${beforeRoom ? 'HAVING lastMessageId<? OR (lastMessageId=? AND r.id<?)' : ''}
      ORDER BY lastMessageId DESC,r.id DESC LIMIT 41`,
    [member, member, member, member, member, member, ...(beforeRoom ? [beforeLastMessage, beforeLastMessage, beforeRoom] : [])]);
    const page = rows.slice(0, 40);
    const last = page.at(-1);
    res.json({ rooms: page, hasMore: rows.length > 40,
      nextCursor: last ? { lastMessageId: Number(last.lastMessageId), roomId: Number(last.id) } : null });
  }));

  app.get('/social/members', privateReply(async (req, res) => {
    const { member } = actor(req, true);
    const search = String(req.query.q ?? '').trim().slice(0, 64);
    if (search.length < 2) { res.json({ members: [] }); return; }
    const rows = await execQuery(`SELECT a.id AS authorId,a.username,a.profile_image AS avatar FROM members a
      WHERE a.id<>? AND (? OR a.id<>1) AND LEFT(LOWER(a.username),CHAR_LENGTH(?))=LOWER(?) AND ${blockFilter('a.id')}
      ORDER BY a.username LIMIT 20`, [member, process.env.APP_STATE === 'dev', search, search, member, member]);
    res.json({ members: rows });
  }));

  app.post('/social/rooms', privateReply(async (req, res) => {
    const { member, owner } = actor(req, true);
    const peer = id(req.body?.memberId);
    if (!peer || peer === member || (peer === 1 && process.env.APP_STATE !== 'dev')) throw new SocialError(400, 'Choose another member.');
    const room = await withTransaction(async query => {
      await rateLimit(query, owner);
      if (!(await query('SELECT id FROM members WHERE id=?', [peer])).length) throw new SocialError(404, 'Member not found.');
      await assertCanInteract(query, member, peer);
      const pair = [Math.min(member, peer), Math.max(member, peer)];
      await query('INSERT IGNORE INTO social_rooms (member_a,member_b) VALUES (?,?)', pair);
      const [row] = await query('SELECT id FROM social_rooms WHERE member_a=? AND member_b=?', pair);
      return row;
    });
    pushSocialChange('rooms', { members: [member, peer] });
    res.json(room);
  }));

  app.post('/social/block', privateReply(async (req, res) => {
    const { member, owner } = actor(req, true);
    const peer = id(req.body?.memberId);
    if (!peer || peer === member || peer === 1) throw new SocialError(400, 'Choose another member.');
    await withTransaction(async query => {
      await rateLimit(query, owner);
      await query('INSERT IGNORE INTO social_blocks (blocker_id,blocked_id) VALUES (?,?)', [member, peer]);
    });
    pushSocialChange('refresh', { members: [member, peer] });
    res.json({ ok: true });
  }));

  app.post('/social/report', privateReply(async (req, res) => {
    const { member, owner } = actor(req);
    await withTransaction(async query => {
      await rateLimit(query, owner);
      const message = await resolveMessageId(query, req.body?.messageId);
      if (!message) throw new SocialError(400, 'Choose a message.');
      const [row] = await query(`SELECT m.id,m.room_id FROM social_messages m
        WHERE m.id=? AND m.author_id<>? AND (m.channel<>'post' OR ${visiblePost})`, [message, member]);
      if (!row) throw new SocialError(404, 'Message not found.');
      if (row.room_id) await roomPeer(query, Number(row.room_id), member);
      await query('INSERT IGNORE INTO social_reports (message_id,reporter_id) VALUES (?,?)', [message, member]);
    });
    res.json({ ok: true });
  }));
}
