import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { SENSOR_STALE_MS } from '@senso/status';
import { formatDevEui } from '@/lib/deveui-format';
import { sendEmail, emailConfigured } from '@/lib/email/send';
import {
  alertEmailSubject,
  alertEmailText,
  alertEmailHtml,
  type AlertLine,
} from '@/lib/email/alert-email';

// Scheduled alerting. Runs every 5 minutes and does two things ingest cannot.
//
// Driven by cron on the ChirpStack VPS rather than Vercel Cron, which on the
// Hobby plan cannot run more often than once a day — useless for a fridge alert.
// The endpoint authenticates by bearer token and does not care who calls it, so
// moving the schedule to Vercel Cron later is a vercel.json entry and nothing
// else. See network-server/README.md for the crontab entry.
//
// 1. Notices silence. Threshold breaches are raised by /api/ingest when a
//    reading arrives, which by definition cannot notice a sensor that has
//    stopped sending. A dead sensor is the case that matters most — a fridge
//    failing and its sensor dying together — and only a sweep can see it.
//
// 2. Sends. Delivery deliberately does not live in ingest: that is the hot path
//    writing the compliance record, and if Resend is slow or down, readings
//    would slow or fail with it. Storing a reading must never depend on an email
//    going out.

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
  const now = Date.now();

  const swept = await sweepForSilence(admin, now);
  const sent = await sendDueAlerts(admin);

  return NextResponse.json({ ...swept, ...sent });
}

// ── 1. Raise and clear offline alerts ───────────────────────────────────────
//
// Sensors only. Gateways are deliberately not alerted on: `gateways.last_seen_at`
// is stamped by /api/ingest on every reading, so "gateway offline" was never an
// independent signal — it meant "no readings from this site", which is exactly
// what this sweep already measures, arriving twice by two routes.
//
// It also put our infrastructure into the customer's inbox. They bought fridge
// monitoring; "Gateway1 is offline" is a Senso problem in Senso's vocabulary. A
// dark site now shows on the admin dashboard instead, where it is ours to fix.
//
// The rollup this replaced existed so a dead gateway did not send ten emails.
// That is already handled elsewhere: the sender groups one email per customer
// listing everything open, so a dark site sends one email naming each silent
// sensor — which is more useful than one naming a box the customer never sees.
//
// `alert_kind` keeps its `gateway_offline` value: past rows are history and are
// protected by RESTRICT. Nothing raises it any more.

async function sweepForSilence(
  admin: ReturnType<typeof createAdminClient>,
  now: number,
) {
  const sensorCutoff = new Date(now - SENSOR_STALE_MS).toISOString();

  // Commissioned only. A sensor that has been registered but not yet installed is
  // silent by design — it may not even be powered on — and raising it as offline
  // would email the customer that a fridge they do not have yet has stopped
  // reporting.
  const { data: sensors } = await admin
    .from('sensors')
    .select('id')
    .is('decommissioned_at', null)
    .not('commissioned_at', 'is', null);

  const sensorIds = (sensors ?? []).map((s) => s.id);

  // Which sensors have reported recently. Asking it this way round avoids
  // per-sensor queries and PostgREST's embedded ordering, which is easy to get
  // subtly wrong and would fail open — a sweep that finds nothing stale looks
  // exactly like a healthy fleet.
  const { data: fresh } = sensorIds.length
    ? await admin
        .from('readings')
        .select('sensor_id')
        .in('sensor_id', sensorIds)
        .gte('recorded_at', sensorCutoff)
    : { data: [] };

  const reportingRecently = new Set((fresh ?? []).map((r) => r.sensor_id as string));

  let sensorsOffline = 0;
  for (const sensor of sensors ?? []) {
    const stale = !reportingRecently.has(sensor.id);

    if (stale) {
      sensorsOffline += 1;
      await openAlert(admin, {
        kind: 'sensor_offline',
        sensor_id: sensor.id,
        triggered_at: new Date(now - SENSOR_STALE_MS).toISOString(),
      });
    } else {
      await admin
        .from('alert_logs')
        .update({ is_resolved: true })
        .eq('sensor_id', sensor.id)
        .eq('kind', 'sensor_offline')
        .eq('is_resolved', false);
    }
  }

  return { sensorsOffline };
}

/**
 * Opens an alert unless one is already open for the same thing.
 *
 * Not an upsert: the guarantee comes from partial unique indexes, and ON
 * CONFLICT cannot infer a partial index — Postgres rejects the statement
 * outright. So this checks first and treats a unique violation from a
 * concurrent run as success, which is what the index is there to make safe.
 */
async function openAlert(
  admin: ReturnType<typeof createAdminClient>,
  alert: {
    kind: 'sensor_offline';
    sensor_id: string;
    triggered_at: string;
  },
) {
  const column = 'sensor_id';
  const value = alert.sensor_id;
  if (!value) return;

  const { data: existing } = await admin
    .from('alert_logs')
    .select('id')
    .eq(column, value)
    .eq('kind', alert.kind)
    .eq('is_resolved', false)
    .maybeSingle();

  if (existing) return;

  const { error } = await admin.from('alert_logs').insert({ ...alert, is_resolved: false });

  // 23505 is the unique index doing its job against a concurrent sweep.
  if (error && error.code !== '23505') {
    console.error('[alerts] could not open alert', { kind: alert.kind, error });
  }
}

// ── 2. Send what is due ─────────────────────────────────────────────────────

async function sendDueAlerts(admin: ReturnType<typeof createAdminClient>) {
  // Claiming is a database function because PostgREST cannot express row
  // locking, and `for update skip locked` is what stops two overlapping runs
  // sending the same alert twice.
  const { data: claimed, error: claimError } = await admin.rpc('claim_due_alerts', {
    p_limit: MAX_ALERTS_PER_RUN,
    p_lease_seconds: 300,
  });

  if (claimError) {
    console.error('[alerts] could not claim alerts', claimError);
    return { claimed: 0, emailed: 0, failed: 0 };
  }

  const alerts = (claimed ?? []) as ClaimedAlert[];
  if (alerts.length === 0) return { claimed: 0, emailed: 0, failed: 0 };

  // Nothing can be delivered, so release every claim rather than counting sends
  // that never happened.
  if (!emailConfigured()) {
    console.error('[alerts] email is not configured; releasing claims');
    await admin.rpc('release_alert_claims', { p_ids: alerts.map((a) => a.id) });
    return { claimed: alerts.length, emailed: 0, failed: alerts.length };
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

    if (result.ok) {
      sentIds.push(...customerAlerts.map((a) => a.id));
    } else {
      failedIds.push(...customerAlerts.map((a) => a.id));
    }
  }

  // Only successful sends advance the schedule. Failures release their lease so
  // the next run retries, rather than silently consuming a reminder.
  if (sentIds.length > 0) {
    await admin.rpc('mark_alerts_notified', { p_ids: sentIds });
  }
  if (failedIds.length > 0) {
    await admin.rpc('release_alert_claims', { p_ids: failedIds });
  }

  return { claimed: alerts.length, emailed: sentIds.length, failed: failedIds.length };
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
