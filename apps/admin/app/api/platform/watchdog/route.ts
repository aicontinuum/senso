import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { JOB_WATCHDOG } from '@/lib/constants';
import {
  assessPlatform,
  PLATFORM_STATUS_COLUMNS,
  type PlatformLevel,
  type PlatformStatusRow,
} from '@/lib/platform-status';
import { sendEmail, emailConfigured } from '@/lib/email/send';
import { opsEmailSubject, opsEmailText, opsEmailHtml } from '@/lib/email/ops-email';

// The platform watchdog. Called every five minutes by pg_cron from inside
// Supabase — deliberately not from the VPS, because the VPS dying is the first
// thing this exists to report.
//
// Reads the same stamps the dashboard card reads, applies the same rules, and
// compares the answer with the level it last reported. Same level: do nothing.
// Different level: one email to OPS_ALERT_EMAIL, then remember the new level.
// A weekend outage is therefore two emails, down and recovered, not five
// hundred. The email goes to that one address and never to a customer.

/** Not a user-facing route; never prerender it. */
export const dynamic = 'force-dynamic';

type WatchdogRow = PlatformStatusRow & {
  ops_level: PlatformLevel;
  ops_level_since: string | null;
  ops_notified_at: string | null;
};

export async function POST(request: Request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const startedAt = new Date(now).toISOString();

  const { data, error } = await admin
    .from('platform_status')
    .select(`${PLATFORM_STATUS_COLUMNS}, ops_level, ops_level_since, ops_notified_at`)
    .eq('id', true)
    .maybeSingle();

  // Cannot tell healthy from down. Say so in the run record; the daily health
  // check is the layer that notices this one, and it must not be papered over
  // by reporting "ok" on a query that failed.
  if (error || !data) {
    console.error('[watchdog] could not read platform_status', error);
    await recordRun(admin, startedAt, false, { error: 'status_unreadable' });
    return NextResponse.json({ error: 'status_unreadable' }, { status: 500 });
  }

  const row = data as unknown as WatchdogRow;
  const assessment = assessPlatform(row, now);
  const previous = row.ops_level;

  if (assessment.level === previous) {
    await recordRun(admin, startedAt, true, { level: assessment.level, changed: false });
    return NextResponse.json({ level: assessment.level, changed: false });
  }

  // The level changed. Tell the one address that should know.
  const to = process.env.OPS_ALERT_EMAIL;
  let notified = false;
  let sendError: string | null = null;

  if (!to || !emailConfigured()) {
    // Nothing to send with. The level is still recorded so the dashboard and
    // the run ledger agree; the log is all that is left for the transition.
    console.error('[watchdog] platform level changed but OPS_ALERT_EMAIL or the mail transport is unconfigured', {
      from: previous, to: assessment.level,
    });
  } else {
    const text = opsEmailText(assessment, row, previous, now);
    const result = await sendEmail({
      to: [to],
      subject: opsEmailSubject(assessment.level),
      text,
      html: opsEmailHtml(text),
    });
    notified = result.ok;
    sendError = result.ok ? null : result.error ?? 'send_failed';
    if (!result.ok) console.error('[watchdog] could not send the ops email', result.error);
  }

  // Remembered only once the email went (or could not be attempted at all), so
  // a provider hiccup means "try again in five minutes" rather than a lost
  // transition. An unconfigured address is not retried: nothing would change.
  const remember = notified || !to || !emailConfigured();
  if (remember) {
    const { error: updateError } = await admin
      .from('platform_status')
      .update({
        ops_level: assessment.level,
        ops_level_since: startedAt,
        ops_notified_at: notified ? startedAt : row.ops_notified_at,
      })
      .eq('id', true);
    if (updateError) console.error('[watchdog] could not record the new level', updateError);
  }

  const detail = { level: assessment.level, previous, changed: true, notified, reason: assessment.reason, sendError };
  await recordRun(admin, startedAt, remember, detail);
  return NextResponse.json(detail);
}

async function recordRun(
  admin: ReturnType<typeof createAdminClient>,
  startedAt: string,
  ok: boolean,
  detail: Record<string, unknown>,
) {
  const { error } = await admin
    .from('job_runs')
    .insert({ job: JOB_WATCHDOG, started_at: startedAt, finished_at: new Date().toISOString(), ok, detail });
  if (error) console.error('[watchdog] could not record run', error);
}
