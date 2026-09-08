import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { sendEmail, emailConfigured } from '@/lib/email/send';
import { ALERTS_HEARTBEAT_MAX_AGE_MS, ALERTS_JOB_KEY } from '@/lib/constants';

// Watches the thing that watches the fridges.
//
// The alert sender runs every five minutes from a crontab on the ChirpStack VPS.
// If it stops — VPS down, crontab wiped, CRON_SECRET drifted — breaches are
// still recorded but nobody is emailed, and nothing says so. That is the
// quietest failure this product has.
//
// So this runs on Vercel, not the VPS. A watchdog on the machine it is watching
// tells you nothing when that machine is the thing that died.
//
// Vercel's Hobby plan will not run cron more than once a day, so detection can
// be up to 24 hours behind. That is the trade being accepted: a slow answer
// beats no answer, and an external dead-man's-switch pinged by the crontab is
// the fast layer to add on top (see TODO.md).
//
// This alerts *us*, never the customer. A stopped scheduler is our failure and
// there is nothing they can do about it.

/** Not a user-facing route; never prerender it. */
export const dynamic = 'force-dynamic';

function humanGap(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hours`;
  return `${Math.floor(hours / 24)} days`;
}

export async function GET(request: Request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: heartbeat, error } = await admin
    .from('job_heartbeats')
    .select('last_run_at')
    .eq('job', ALERTS_JOB_KEY)
    .maybeSingle();

  if (error) {
    // Cannot tell healthy from stopped, which is itself worth knowing about.
    console.error('[health] could not read the heartbeat', error);
    return NextResponse.json({ error: 'heartbeat_unreadable' }, { status: 500 });
  }

  const lastRunMs = heartbeat ? new Date(heartbeat.last_run_at).getTime() : null;
  const ageMs = lastRunMs === null ? null : Date.now() - lastRunMs;
  const healthy = ageMs !== null && ageMs <= ALERTS_HEARTBEAT_MAX_AGE_MS;

  if (healthy) {
    return NextResponse.json({ healthy: true, lastRunAt: heartbeat!.last_run_at, ageMs });
  }

  // A missing row is not a gap to measure — it means the sender has never
  // completed a run since this table existed, which is the same conclusion.
  const summary =
    lastRunMs === null
      ? 'The alert sender has never completed a run.'
      : `The alert sender has not run for ${humanGap(ageMs!)} — last completed ${heartbeat!.last_run_at}.`;

  console.error('[health] alert sender is not running', { lastRunAt: heartbeat?.last_run_at ?? null, ageMs });

  const to = process.env.OPS_ALERT_EMAIL;
  if (!to || !emailConfigured()) {
    // Nothing else to try. Loud in the log is all that is left, and saying so
    // beats returning a healthy-looking 200.
    console.error('[health] cannot send the warning: OPS_ALERT_EMAIL or the mail transport is unconfigured');
    return NextResponse.json({ healthy: false, notified: false, reason: 'email_not_configured' });
  }

  const body = [
    summary,
    '',
    'Temperature breaches are still being recorded, but no alert emails are going out.',
    '',
    'Check, in order:',
    '  1. Is the VPS up?',
    '  2. Is the crontab entry still there?  crontab -l',
    '  3. Does the log show failures?        tail /var/log/senso-alerts.log',
    '  4. Does CRON_SECRET still match the value in Vercel?',
    '',
    'Runbook: network-server/README.md, "Alert scheduler".',
  ].join('\n');

  const result = await sendEmail({
    to: [to],
    subject: 'Senso: alert sender is not running',
    text: body,
    html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`,
  });

  if (!result.ok) {
    console.error('[health] could not send the warning', result.error);
  }

  return NextResponse.json({ healthy: false, notified: result.ok, ageMs });
}
