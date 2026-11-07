import type { Request, Response } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const cookieName = 'clikbCreationGuest';
/** Guest account 1 needs a private draft scope independent of its shared account ID. */
export function creationGuestScope(req: Request, res?: Response, create = false): string | null {
  const secret = process.env.SECRET_KEYY;
  if (!secret) return null;
  const cookie = typeof req.cookies?.[cookieName] === 'string' ? req.cookies[cookieName] : '';
  const [token, signature] = cookie.split('.');
  if (token && signature && /^[a-f0-9]{64}$/.test(token) && /^[a-f0-9]{64}$/.test(signature)) {
    const expected = createHmac('sha256', secret).update(token).digest('hex');
    if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return createHmac('sha256', secret).update(`scope:${token}`).digest('hex');
  }
  if (!create || !res) return null;
  const next = randomBytes(32).toString('hex'), signed = createHmac('sha256', secret).update(next).digest('hex');
  res.cookie(cookieName, `${next}.${signed}`, { httpOnly: true, sameSite: process.env.APP_STATE === 'dev' ? 'lax' : 'none', secure: process.env.APP_STATE !== 'dev', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
  return createHmac('sha256', secret).update(`scope:${next}`).digest('hex');
}
