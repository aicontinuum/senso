import { timingSafeEqual } from 'crypto';

// Verify a gateway request against its stored secret.
//
// Rollout-safe by design: if no secret is configured for the gateway (the
// column is absent or the value is null), the request is allowed — so deploying
// this before secrets are provisioned can't break ingestion. Once a secret is
// set on the gateway row, it is required. Every gateway must have a secret
// before go-live (see TODO.md).
export function gatewaySecretOk(request: Request, expectedSecret: string | null): boolean {
  if (!expectedSecret) return true; // not enforced yet

  const auth = request.headers.get('authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false; // lengths differ → reject (secret length isn't sensitive)
  return timingSafeEqual(a, b);
}
