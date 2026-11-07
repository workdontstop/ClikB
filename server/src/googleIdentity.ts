import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';

let keys: { expires: number; values: any[] } | undefined;

export async function verifiedGoogleEmail(input: unknown): Promise<string> {
  const audience = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  if (!audience || typeof input !== 'string' || input.length > 8192) throw new Error('Google credential unavailable');
  const decoded = jwt.decode(input, { complete: true });
  if (!decoded?.header.kid || decoded.header.alg !== 'RS256') throw new Error('Invalid Google credential');
  if (!keys || keys.expires < Date.now() || !keys.values.some(key => key.kid === decoded.header.kid)) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Google verification unavailable');
    const body = await response.json() as { keys: any[] };
    keys = { values: body.keys, expires: Date.now() + 300_000 };
  }
  const key = keys.values.find(key => key.kid === decoded.header.kid && key.kty === 'RSA');
  if (!key) throw new Error('Unknown Google signing key');
  const claims = jwt.verify(input, createPublicKey({ key, format: 'jwk' }), {
    algorithms: ['RS256'], audience, issuer: ['accounts.google.com', 'https://accounts.google.com'],
  });
  if (typeof claims !== 'object' || !claims.exp || claims.email_verified !== true || typeof claims.email !== 'string') throw new Error('Unverified Google email');
  return claims.email;
}
