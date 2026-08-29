import { timingSafeEqual } from 'crypto';

// Authorisation for scheduled routes. Same shape as ingest-auth: fail closed, so
// an unconfigured deployment refuses rather than exposing the endpoint. Vercel
// Cron sends the secret as a bearer token.
export function cronSecretOk(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const auth = request.headers.get('authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
