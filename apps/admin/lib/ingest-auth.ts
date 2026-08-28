import { timingSafeEqual } from 'crypto';

// Verify a request from ChirpStack's HTTP integration against our shared secret.
//
// Deliberately **fail-closed**, unlike the older per-gateway `gatewaySecretOk`:
// if `CHIRPSTACK_INGEST_SECRET` is unset, every request is rejected rather than
// waved through. The old helper was rollout-safe (no secret = allowed) so that
// deploying auth before provisioning gateways couldn't break ingestion — but that
// leaves an unauthenticated write path into the compliance record, which is the
// "device auth is fail-open" item in TODO.md. There's no rollout problem here:
// one secret, set once, before the integration is switched on.
//
// ChirpStack sends it as a custom header on the HTTP integration:
//   Authorization: Bearer <CHIRPSTACK_INGEST_SECRET>
export function integrationSecretOk(request: Request): boolean {
  const expected = process.env.CHIRPSTACK_INGEST_SECRET;
  if (!expected) return false; // fail closed — unconfigured means unauthorized

  const auth = request.headers.get('authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // length mismatch → reject before comparing
  return timingSafeEqual(a, b);
}
