import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { ALERTS_JOB_KEY, JOB_SENDER } from '@/lib/constants';
import { formatDevEui } from '@/lib/deveui-format';
import {
  assessPlatform,
  stampPlatform,
  PLATFORM_STATUS_COLUMNS,
  type PlatformStatusRow,
} from '@/lib/platform-status';
import { sendEmail, emailConfigured } from '@/lib/email/send';
import {
  alertEmailSubject,
  alertEmailText,
  alertEmailHtml,
  type AlertLine,
} from '@/lib/email/alert-email';

// The sender. Runs every 5 minutes and does one thing: delivers what the
// database says is due.
//
// It decides nothing. Threshold breaches are judged by the trigger that stores
// the reading; silent sensors are found by `sweep_offline_sensors()` on a
// pg_cron schedule inside Postgres (20260910_alerting_v2_cutover.sql). Both
// happen whether or not this route ever runs. Until 2026-09-10 the sweep lived
// here and inferred silence from a readings query whose failure looked exactly
// like a silent fleet; that is why it moved.
//
// Delivery deliberately does not live in ingest: that is the hot path writing
// the compliance record, and if Resend is slow or down, readings would slow or
// fail with it. Storing a reading must never depend on an email going out.
//
// Driven by cron on the ChirpStack VPS rather than Vercel Cron, which on the
// Hobby plan cannot run more often than once a day. The endpoint authenticates
// by bearer token and does not care who calls it; phase 5 moves the schedule
// into the database. See network-server/README.md for the crontab entry.

/** Not a user-facing route; never prerender it. */
export const dynamic = 'force-dynamic';

/** How many alerts one run will send for, so a backlog cannot run past the
 *  platform's function timeout and leave every claim on a stale lease. */
const MAX_ALERTS_PER_RUN = 100;

type ClaimedAlert = {
  id: string;
  // Only these two can be claimed. `gateway_offline` still exists in the enum
  // for history, but nothing raises it and the open ones were closed by
  // 20260902_retire_gateway_alerts.sql, so none can reach the sender.
  kind: 'threshold' | 'sensor_offline';
  alert_config_id: string | null;
  reading_id: string | null;
  sensor_id: string | null;
  triggered_at: string;
  notify_count: number;
};

export async function GET(request: Request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // One job, one row in job_runs. A throw is recorded rather than surfaced, so
  // the heartbeat below still stamps and the watchdog sees a completed run
  // with ok = false rather than a missing one.
  const result = await runJob(admin, JOB_SENDER, () => sendDueAlerts(admin));

  // Stamped last, and only on the way out, so it means "a run completed" rather
  // than "a run started". A run that throws never reaches this line, which is
  // what lets the watchdog tell a stopped scheduler from a broken one — both
  // leave the stamp stale.
  //
  // Deliberately stamped even when there was nothing to do: an idle sweep is
  // still proof the scheduler is alive, and that is the whole signal.
  //
  // Kept through phase 4: the daily health check still reads this row. The
  // durable record is job_runs, written above.
  const { error: heartbeatError } = await admin
    .from('job_heartbeats')
    .upsert(
      { job: ALERTS_JOB_KEY, last_run_at: new Date().toISOString(), detail: result },
      { onConflict: 'job' },
    );

  // Logged, not fatal. Failing the run because the bookkeeping failed would turn
  // a monitoring problem into an alerting outage, which is backwards.
  if (heartbeatError) {
    console.error('[alerts] heartbeat write failed', heartbeatError);
  }

  return NextResponse.json(result);
}

// ── Bookkeeping ─────────────────────────────────────────────────────────────

/** What a job hands back: its counts, and whether it did what it set out to. */
type JobOutcome = Record<string, unknown> & { ok: boolean };

/**
 * Runs one job and appends the outcome to job_runs, then stamps
 * platform_status if it went well. A job that throws is recorded as failed
 * with the message, and the throw is swallowed.
 *
 * The record is written after the run rather than opened before it, so one
 * insert covers it. The cost is that a run killed by the platform's timeout
 * leaves no row; the stale platform_status stamp is what shows that case.
 */
async function runJob(
  admin: ReturnType<typeof createAdminClient>,
  job: typeof JOB_SENDER,
  run: () => Promise<JobOutcome>,
): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  let outcome: JobOutcome;
  try {
    outcome = await run();
  } catch (error) {
    console.error(`[alerts] ${job} threw`, error);
    outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const { ok, ...detail } = outcome;
  const finishedAt = new Date().toISOString();

  const { error: runError } = await admin
    .from('job_runs')
    .insert({ job, started_at: startedAt, finished_at: finishedAt, ok, detail });
  if (runError) console.error(`[alerts] could not record ${job} run`, runError);

  if (ok) {
    await stampPlatform(admin, { sender_last_ok_at: finishedAt });
  }

  return detail;
}

// ── Send what is due ────────────────────────────────────────────────────────

async function sendDueAlerts(admin: ReturnType<typeof createAdminClient>): Promise<JobOutcome> {
  // Hold while the platform is down. Every alert open at that moment is either
  // about to be closed by readings resuming, or a real problem that has been
  // masked by ours — and either way it must not be the customer's first news of
  // an outage on Senso's side. The same rule the SQL sweep applies, read from
  // the same row. A run that holds is still a completed run: ok, nothing sent,
  // and it says why.
  const { data: status, error: statusError } = await admin
    .from('platform_status')
    .select(PLATFORM_STATUS_COLUMNS)
    .eq('id', true)
    .maybeSingle();
  if (statusError) {
    // Cannot tell up from down. Holding is the safe direction: a late email is
    // recoverable, an email about our own outage is not.
    console.error('[alerts] could not read platform_status; holding', statusError);
    return { ok: false, claimed: 0, emailed: 0, failed: 0, error: 'status_unreadable' };
  }
  if (assessPlatform((status as PlatformStatusRow | null) ?? null).level === 'down') {
    return { ok: true, claimed: 0, emailed: 0, failed: 0, held: 'platform_down' };
  }

  // Claiming is a database function because PostgREST cannot express row
  // locking, and `for update skip locked` is what stops two overlapping runs
  // sending the same alert twice.
  const { data: claimed, error: claimError } = await admin.rpc('claim_due_alerts', {
    p_limit: MAX_ALERTS_PER_RUN,
    p_lease_seconds: 300,
  });

  if (claimError) {
    console.error('[alerts] could not claim alerts', claimError);
    return { ok: false, claimed: 0, emailed: 0, failed: 0, error: 'claim_failed' };
  }

  const alerts = (claimed ?? []) as ClaimedAlert[];
  if (alerts.length === 0) return { ok: true, claimed: 0, emailed: 0, failed: 0 };

  // Nothing can be delivered, so release every claim rather than counting sends
  // that never happened. The run itself did not do its job, and says so.
  if (!emailConfigured()) {
    console.error('[alerts] email is not configured; releasing claims');
    await admin.rpc('release_alert_claims', { p_ids: alerts.map((a) => a.id) });
    return { ok: false, claimed: alerts.length, emailed: 0, failed: alerts.length, error: 'email_not_configured' };
  }

  const context = await loadContext(admin, alerts);

  // One email per customer, listing everything open for them. This is what makes
  // gateway rollup unnecessary: a dark site raises one alert per silent sensor
  // and they arrive as a single email naming each of them.
  const byCustomer = new Map<string, ClaimedAlert[]>();
  for (const alert of alerts) {
    const customerId = context.customerIdByAlert.get(alert.id);
    if (!customerId) continue;
    byCustomer.set(customerId, [...(byCustomer.get(customerId) ?? []), alert]);
  }

  const sentIds: string[] = [];
  const failedIds: string[] = [];

  for (const [customerId, customerAlerts] of byCustomer) {
    const customer = context.customers.get(customerId);
    const recipients = context.recipientsByCustomer.get(customerId) ?? [];

    // No recipients is a configuration state, not a failure. Counting the send
    // stops it being retried every five minutes forever.
    if (!customer || recipients.length === 0) {
      sentIds.push(...customerAlerts.map((a) => a.id));
      continue;
    }

    const lines: AlertLine[] = customerAlerts.map((alert) => ({
      kind: alert.kind,
      subject: context.subjectByAlert.get(alert.id) ?? 'Sensor',
      deviceId: formatDevEui(context.hardwareIdByAlert.get(alert.id)),
      reading: context.readingByAlert.get(alert.id) ?? null,
      range: context.rangeByAlert.get(alert.id) ?? null,
      triggeredAt: alert.triggered_at,
      notifyCount: alert.notify_count,
    }));

    const payload = {
      customerName: customer.name,
      // Explicit, from the customer's own row. This process runs in UTC.
      timezone: customer.timezone,
      alerts: lines,
      appUrl: process.env.CUSTOMER_APP_URL ?? 'https://sensoqa.com',
    };

    const result = await sendEmail({
      to: recipients,
      subject: alertEmailSubject(lines, customer.name),
      text: alertEmailText(payload),
      html: alertEmailHtml(payload),
    });

    const alertIds = customerAlerts.map((a) => a.id);
    if (result.ok) {
      sentIds.push(...alertIds);
    } else {
      failedIds.push(...alertIds);
    }

    // The compliance record of the attempt: who was told, at which addresses,
    // and whether the provider took it. Written whether or not it went, and its
    // own failure is logged rather than allowed to undo a send that happened.
    const attemptedAt = new Date().toISOString();
    const { error: ledgerError } = await admin.from('alert_notifications').insert({
      customer_id: customerId,
      alert_ids: alertIds,
      recipients,
      attempted_at: attemptedAt,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.ok ? result.id ?? null : null,
      error: result.ok ? null : result.error ?? null,
    });
    if (ledgerError) console.error('[alerts] could not record notification', ledgerError);
    if (result.ok) await stampPlatform(admin, { last_customer_email_at: attemptedAt });
  }

  // Only successful sends advance the schedule. Failures release their lease so
  // the next run retries, rather than silently consuming a reminder.
  if (sentIds.length > 0) {
    await admin.rpc('mark_alerts_notified', { p_ids: sentIds });
  }
  if (failedIds.length > 0) {
    await admin.rpc('release_alert_claims', { p_ids: failedIds });
  }

  return { ok: true, claimed: alerts.length, emailed: sentIds.length, failed: failedIds.length };
}

// ── Context lookup ──────────────────────────────────────────────────────────
//
// Resolves each claimed alert to the customer it belongs to and the details the
// email needs. Batched by id rather than queried per alert.

async function loadContext(
  admin: ReturnType<typeof createAdminClient>,
  alerts: ClaimedAlert[],
) {
  const configIds = alerts.map((a) => a.alert_config_id).filter(Boolean) as string[];
  const readingIds = alerts.map((a) => a.reading_id).filter(Boolean) as string[];
  const directSensorIds = alerts.map((a) => a.sensor_id).filter(Boolean) as string[];

  const [configsRes, readingsRes] = await Promise.all([
    configIds.length
      ? admin.from('alert_configs').select('id, sensor_id, type, threshold').in('id', configIds)
      : Promise.resolve({ data: [] }),
    readingIds.length
      ? admin.from('readings').select('id, temperature').in('id', readingIds)
      : Promise.resolve({ data: [] }),
  ]);

  const configs = new Map(
    ((configsRes.data ?? []) as { id: string; sensor_id: string; type: string; threshold: number }[])
      .map((c) => [c.id, c]),
  );
  const readings = new Map(
    ((readingsRes.data ?? []) as { id: string; temperature: number }[]).map((r) => [r.id, r]),
  );
  const sensorIds = [
    ...new Set([...directSensorIds, ...[...configs.values()].map((c) => c.sensor_id)]),
  ];
  const { data: sensorRows } = sensorIds.length
    ? await admin
        .from('sensors')
        .select('id, name, hardware_id, gateway_id, gateways!inner (customer_id)')
        .in('id', sensorIds)
    : { data: [] };

  const sensors = new Map(
    ((sensorRows ?? []) as unknown as {
      id: string; name: string; hardware_id: string | null;
      gateways: { customer_id: string };
    }[]).map((s) => [s.id, s]),
  );

  const customerIds = [...new Set([...sensors.values()].map((s) => s.gateways.customer_id))];

  const { data: customerRows } = customerIds.length
    ? await admin.from('customers').select('id, name, timezone, alert_recipients').in('id', customerIds)
    : { data: [] };

  const customers = new Map(
    ((customerRows ?? []) as {
      id: string; name: string; timezone: string; alert_recipients: unknown;
    }[]).map((c) => [c.id, c]),
  );

  // One list per customer: `customers.alert_recipients`.
  //
  // There used to be a second, per-sensor list unioned into this one. It promised
  // per-fridge routing it could not deliver — a union can only add people, never
  // narrow, and one email covers every alert open for a customer, so anyone added
  // to one sensor received the others anyway.
  //
  // It also made recipients depend on timing. Per-sensor lists were loaded only
  // for alerts carrying an alert_config_id, so an offline alert (which has none)
  // reached the account list alone — unless a threshold alert for the same
  // customer happened to be claimed in the same five-minute run, which pulled
  // that sensor's list in too. Same alert, different recipients, decided by what
  // else broke at that moment. Worst case, a customer with addresses only on
  // sensors and none on the account was emailed by nobody, and the send counted
  // as done.
  //
  // A single list resolved per customer cannot vary with batch composition, so
  // collapsing the two *is* the fix, not a step towards it.
  const recipientsByCustomer = new Map<string, string[]>();
  for (const [id, customer] of customers) {
    const accountWide = Array.isArray(customer.alert_recipients)
      ? (customer.alert_recipients as string[])
      : [];
    recipientsByCustomer.set(id, [...new Set(accountWide.map((e) => e.toLowerCase()))]);
  }

  const customerIdByAlert = new Map<string, string>();
  const subjectByAlert = new Map<string, string>();
  const hardwareIdByAlert = new Map<string, string | null>();
  const readingByAlert = new Map<string, string | null>();
  const rangeByAlert = new Map<string, string | null>();

  for (const alert of alerts) {
    const sensorId =
      alert.sensor_id ??
      (alert.alert_config_id ? configs.get(alert.alert_config_id)?.sensor_id : undefined);
    if (!sensorId) continue;
    const sensor = sensors.get(sensorId);
    if (!sensor) continue;

    customerIdByAlert.set(alert.id, sensor.gateways.customer_id);
    subjectByAlert.set(alert.id, sensor.name);
    hardwareIdByAlert.set(alert.id, sensor.hardware_id);

    if (alert.kind === 'threshold' && alert.reading_id) {
      const reading = readings.get(alert.reading_id);
      if (reading) readingByAlert.set(alert.id, `${reading.temperature.toFixed(1)}°C`);

      // Both bounds for the sensor, so the email says what range was broken and
      // not merely which single limit fired.
      const bounds = [...configs.values()].filter((c) => c.sensor_id === sensorId);
      const min = bounds.find((c) => c.type === 'min')?.threshold;
      const max = bounds.find((c) => c.type === 'max')?.threshold;
      if (min !== undefined && max !== undefined) {
        rangeByAlert.set(alert.id, `${min.toFixed(1)}°C – ${max.toFixed(1)}°C`);
      }
    }
  }

  return {
    customers,
    recipientsByCustomer,
    customerIdByAlert,
    subjectByAlert,
    hardwareIdByAlert,
    readingByAlert,
    rangeByAlert,
  };
}
