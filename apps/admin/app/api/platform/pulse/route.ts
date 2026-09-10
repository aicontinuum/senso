import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { stampPlatform } from '@/lib/platform-status';

// "I'm alive", from the ChirpStack VPS, once a minute.
//
// This is the platform's own pulse and the only thing left on the VPS that
// talks to Senso. Its absence is how the admin dashboard, and from phase 4 the
// offline sweep, learn that the road from the fridges to the database is closed
// for reasons that are ours — so that nothing about it ever reaches a customer.
//
// The body is optional. When present, `chirpstack_ok` says whether the
// ChirpStack container answered a local health request in the same crontab
// line, which tells "the box is up but the service is not" apart from "the box
// is gone". See network-server/README.md for the crontab entry.

/** Not a user-facing route; never prerender it. */
export const dynamic = 'force-dynamic';

type PulseBody = { chirpstack_ok?: unknown };

export async function POST(request: Request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // An empty or malformed body is still a pulse: the box reached us. Only a
  // boolean is trusted for the ChirpStack flag; anything else is "not reported".
  const body = (await request.json().catch(() => ({}))) as PulseBody;
  const chirpstackOk = typeof body.chirpstack_ok === 'boolean' ? body.chirpstack_ok : null;

  await stampPlatform(createAdminClient(), {
    vps_last_seen_at: new Date().toISOString(),
    chirpstack_ok: chirpstackOk,
  });

  return NextResponse.json({ ok: true });
}
