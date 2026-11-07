import type { Express, NextFunction, Request, Response } from 'express';
import execQuery, { withTransaction } from './execQuery';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { generateToken } from './jwtUtils';

const unavailable = (err: any) => err?.code === 'ER_NO_SUCH_TABLE';
const memberId = (input: unknown) => /^[1-9][0-9]{0,14}$/.test(String(input)) ? String(input) : '';
const username = (input: unknown) => typeof input === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(input.trim()) ? input.trim() : '';
const mayCreateProfile = (owner: string | null) => Boolean(owner && (owner !== '1' || process.env.APP_STATE === 'dev'));
const publicMember = (row: any) => ({ id: Number(row.id), username: row.username, image: row.profile_image_thumb || row.profile_image || '' });

export async function activeCreativeProfileIsOwned(active: string, owner: string) {
  if (active === owner) return true;
  const rows = await execQuery('SELECT member_id FROM creative_profiles WHERE member_id=? AND owner_id=? AND deleted_at IS NULL', [active, owner]);
  return Boolean(rows.length);
}

export function writeMemberSession(res: Response, activeId: string | number, ownerId: string | number = activeId) {
  const development = process.env.APP_STATE === 'dev';
  res.cookie('authToken', generateToken(activeId, ownerId), {
    httpOnly: true, secure: !development, sameSite: development ? 'lax' : 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export async function validateCreativeProfileSession(req: Request, res: Response, next: NextFunction) {
  const active = authenticatedUserId(req);
  const owner = authenticatedOwnerId(req);
  const expected = req.get('x-clikb-active-member');
  if (expected && expected !== active && req.path !== '/checkIsLogged') {
    res.status(409).json({ message: 'The active profile changed in another tab. Reload to continue.' });
    return;
  }
  if (!active || !owner || active === owner) { next(); return; }
  try {
    if (await activeCreativeProfileIsOwned(active, owner)) { next(); return; }
  } catch {
    res.status(503).json({ message: 'Creative Profile access is temporarily unavailable.' });
    return;
  }
  writeMemberSession(res, owner);
  if (req.path === '/checkIsLogged') {
    Object.assign(req, { authenticatedUserId: owner, authenticatedOwnerId: owner });
    next();
    return;
  }
  res.status(401).json({ message: 'This Creative Profile is unavailable. Reopen Main to continue.' });
}

export function registerCreativeProfileRoutes(app: Express) {
  const route = (handler: (req: Request, res: Response) => Promise<unknown>, publicRead = false) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    const owner = authenticatedOwnerId(req);
    if (!publicRead && !owner) {
      res.status(403).json({ message: 'Sign in to manage Creative Profiles.' });
      return;
    }
    try { await handler(req, res); }
    catch (error: any) {
      if (unavailable(error) && publicRead) { res.json({ main: null, profiles: [], managed: false }); return; }
      if (error?.code === 'ER_DUP_ENTRY') { res.status(409).json({ message: 'That username is already taken.' }); return; }
      res.status(unavailable(error) ? 503 : 500).json({ message: 'Creative Profiles are temporarily unavailable.' });
    }
  };

  app.get('/creative-profiles/:memberId/catalogue', route(async (req, res) => {
    const target = memberId(req.params.memberId);
    if (!target) return res.status(400).json({ message: 'Choose a profile.' });
    const rows = await execQuery('SELECT owner_id,deleted_at FROM creative_profiles WHERE member_id=?', [target]);
    if (rows[0]?.deleted_at) return res.status(404).json({ message: 'Creative Profile unavailable.' });
    const mainId = rows[0] ? String(rows[0].owner_id) : target;
    const [main, profiles] = await Promise.all([
      execQuery('SELECT id,username,profile_image,profile_image_thumb FROM members WHERE id=?', [mainId]),
      execQuery('SELECT m.id,m.username,m.profile_image,m.profile_image_thumb FROM creative_profiles c JOIN members m ON m.id=c.member_id WHERE c.owner_id=? AND c.deleted_at IS NULL ORDER BY m.id', [mainId]),
    ]);
    const owner = authenticatedOwnerId(req);
    return res.json({ main: main[0] ? publicMember(main[0]) : null, profiles: profiles.map(publicMember), managed: Boolean(rows[0]),
      canCreate: owner === mainId && mayCreateProfile(owner) });
  }, true));

  app.get('/creative-profiles/username', route(async (req, res) => {
    if (!mayCreateProfile(authenticatedOwnerId(req))) return res.status(403).json({ message: 'Sign in to create a Creative Profile.' });
    const name = username(req.query.username);
    if (!name) return res.json({ available: false });
    const rows = await execQuery('SELECT id FROM members WHERE LOWER(username)=LOWER(?) LIMIT 1', [name]);
    return res.json({ available: !rows.length });
  }));

  app.post('/creative-profiles', route(async (req, res) => {
    const owner = authenticatedOwnerId(req)!;
    if (!mayCreateProfile(owner)) return res.status(403).json({ message: 'Sign in to create a Creative Profile.' });
    const name = username(req.body?.username);
    if (!name) return res.status(400).json({ message: 'Use 3 to 32 letters, numbers, or underscores.' });
    const id = await withTransaction(async query => {
      const existing = await query('SELECT id FROM members WHERE LOWER(username)=LOWER(?) LIMIT 1', [name]);
      if (existing.length) return null;
      const created = await query(`INSERT INTO members
        (username,password,email,billboard1,billboardthumb1,billboard2,billboardthumb2,profile_image,profile_image_thumb,color1,color2,color_type,status,notification,tutorial,date,reg,pixels)
        SELECT ?,NULL,NULL,billboard1,billboardthumb1,billboard2,billboardthumb2,profile_image,profile_image_thumb,color1,color2,color_type,1,0,1,NOW(),0,0
        FROM members WHERE id=?`, [name, owner]);
      if (created.affectedRows !== 1) throw new Error('Main member unavailable');
      await query('INSERT INTO creative_profiles (member_id,owner_id,username_key) VALUES (?,?,?)', [created.insertId, owner, name.toLowerCase()]);
      return Number(created.insertId);
    });
    if (!id) return res.status(409).json({ message: 'That username is already taken.' });
    writeMemberSession(res, id, owner);
    return res.status(201).json({ activeId: id });
  }));

  app.post('/creative-profiles/switch', route(async (req, res) => {
    const owner = authenticatedOwnerId(req)!;
    const target = memberId(req.body?.memberId);
    if (!target) return res.status(400).json({ message: 'Choose a profile.' });
    if (target !== owner) {
      const rows = await execQuery('SELECT member_id FROM creative_profiles WHERE member_id=? AND owner_id=? AND deleted_at IS NULL', [target, owner]);
      if (!rows.length) return res.status(403).json({ message: 'You cannot use this profile.' });
    }
    writeMemberSession(res, target, owner);
    return res.json({ activeId: Number(target) });
  }));

  app.patch('/creative-profiles/:memberId/details', route(async (req, res) => {
    const owner = authenticatedOwnerId(req)!;
    const target = memberId(req.params.memberId);
    if (!target || target !== authenticatedUserId(req) || target === owner) return res.status(403).json({ message: 'Use the Creative Profile first.' });
    const { name, biography } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length > 60 || typeof biography !== 'string' || biography.trim().length > 500) {
      return res.status(400).json({ message: 'Use a name of up to 60 characters and a bio of up to 500.' });
    }
    const result = await execQuery(`UPDATE members m JOIN creative_profiles p ON p.member_id=m.id
      SET m.first_name=?,m.sur_name='',m.biography=? WHERE p.member_id=? AND p.owner_id=? AND p.deleted_at IS NULL`,
      [name.trim(), biography.trim(), target, owner]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Creative Profile unavailable.' });
    return res.json({ name: name.trim(), biography: biography.trim() });
  }));

  app.delete('/creative-profiles/:memberId', route(async (req, res) => {
    const owner = authenticatedOwnerId(req)!;
    const target = memberId(req.params.memberId);
    if (!target || target === owner) return res.status(400).json({ message: 'Choose a Creative Profile.' });
    const result = await withTransaction(async query => {
      const profiles = await query('SELECT member_id FROM creative_profiles WHERE member_id=? AND owner_id=? AND deleted_at IS NULL FOR UPDATE', [target, owner]);
      if (!profiles.length) return 'unavailable';
      const posts = await query('SELECT id FROM posts WHERE sender=? LIMIT 1', [target]);
      if (posts.length) return 'has_content';
      try {
        const drafts = await query('SELECT draft_id FROM creation_drafts WHERE user_id=? LIMIT 1', [target]);
        if (drafts.length) return 'has_content';
      } catch (error) {
        if (!unavailable(error)) throw error;
      }
      await query('UPDATE creative_profiles SET deleted_at=NOW() WHERE member_id=? AND owner_id=? AND deleted_at IS NULL', [target, owner]);
      return 'removed';
    });
    if (result === 'unavailable') return res.status(404).json({ message: 'Creative Profile unavailable.' });
    if (result === 'has_content') return res.status(409).json({ message: 'Use this Creative Profile and delete its posts and saved drafts before removing it.' });
    const active = authenticatedUserId(req) === target ? owner : authenticatedUserId(req)!;
    writeMemberSession(res, active, owner);
    return res.json({ activeId: Number(active) });
  }));
}
