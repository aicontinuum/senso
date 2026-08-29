import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cronSecretOk } from '@/lib/cron-auth';
import { SENSOR_STALE_MS, GATEWAY_STALE_MS } from '@senso/status';
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
  kind: 'threshold' | 'sensor_offline' | 'gateway_offline';
  alert_config_id: string | null;
  reading_id: string | null;
  sensor_id: string | null;
  gateway_id: string | null;
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

async function sweepForSilence(
  admin: ReturnType<typeof createAdminClient>,
  now: number,
) {
  const sensorCutoff = new Date(now - SENSOR_STALE_MS).toISOString();
  const gatewayCutoff = new Date(now - GATEWAY_STALE_MS).toISOString();

  // Gateways first: if one is down, every sensor behind it is silent as a
  // consequence, not as ten separate faults.
  const { data: gateways } = await admin
    .from('gateways')
    .select('id, customer_id, last_seen_at')
    .is('decommissioned_at', null);

  const offlineGatewayIds = new Set<string>();
  for (const gateway of gateways ?? []) {
    const stale = !gateway.last_seen_at || gateway.last_seen_at < gatewayCutoff;
    if (stale) {
      offlineGatewayIds.add(gateway.id);
      await openAlert(admin, {
        kind: 'gateway_offline',
        gateway_id: gateway.id,
        triggered_at: gateway.last_seen_at ?? new Date(now).toISOString(),
      });
    } else {
      await admin
        .from('alert_logs')
        .update({ is_resolved: true })
        .eq('gateway_id', gateway.id)
        .eq('kind', 'gateway_offline')
        .eq('is_resolved', false);
    }
  }

  const { data: sensors } = await admin
    .from('sensors')
    .select('id, gateway_id')
    .is('decommissioned_at', null);

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

    if (stale && offlineGatewayIds.has(sensor.gateway_id)) {
      // Suppressed rather than raised: the gateway alert already says this site
      // is dark, and one email beats ten saying the same thing.
      continue;
    }

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

  return { gatewaysOffline: offlineGatewayIds.size, sensorsOffline };
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
    kind: 'sensor_offline' | 'gateway_offline';
    sensor_id?: string;
    gateway_id?: string;
    triggered_at: string;
  },
) {
  const column = alert.kind === 'gateway_offline' ? 'gateway_id' : 'sensor_id';
  const value = alert.gateway_id ?? alert.sensor_id;
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

  // One email per customer, listing everything open for them. A gateway going
  // down otherwise means ten separate emails at three in the morning.
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
  const gatewayIds = alerts.map((a) => a.gateway_id).filter(Boolean) as string[];

  const [configsRes, readingsRes, gatewaysRes] = await Promise.all([
    configIds.length
      ? admin.from('alert_configs').select('id, sensor_id, type, threshold').in('id', configIds)
      : Promise.resolve({ data: [] }),
    readingIds.length
      ? admin.from('readings').select('id, temperature').in('id', readingIds)
      : Promise.resolve({ data: [] }),
    gatewayIds.length
      ? admin.from('gateways').select('id, name, customer_id').in('id', gatewayIds)
      : Promise.resolve({ data: [] }),
  ]);

  const configs = new Map(
    ((configsRes.data ?? []) as { id: string; sensor_id: string; type: string; threshold: number }[])
      .map((c) => [c.id, c]),
  );
  const readings = new Map(
    ((readingsRes.data ?? []) as { id: string; temperature: number }[]).map((r) => [r.id, r]),
  );
  const gateways = new Map(
    ((gatewaysRes.data ?? []) as { id: string; name: string | null; customer_id: string }[])
      .map((g) => [g.id, g]),
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

  const customerIds = [
    ...new Set([
      ...[...sensors.values()].map((s) => s.gateways.customer_id),
      ...[...gateways.values()].map((g) => g.customer_id),
    ]),
  ];

  const { data: customerRows } = customerIds.length
    ? await admin.from('customers').select('id, name, timezone, alert_recipients').in('id', customerIds)
    : { data: [] };

  const customers = new Map(
    ((customerRows ?? []) as {
      id: string; name: string; timezone: string; alert_recipients: unknown;
    }[]).map((c) => [c.id, c]),
  );

  // Per-sensor recipients sit on the alert config; account-wide ones on the
  // customer. The send list is the union, de-duplicated.
  const recipientsByCustomer = new Map<string, string[]>();
  for (const [id, customer] of customers) {
    const accountWide = Array.isArray(customer.alert_recipients)
      ? (customer.alert_recipients as string[])
      : [];
    recipientsByCustomer.set(id, [...new Set(accountWide.map((e) => e.toLowerCase()))]);
  }

  const { data: configRecipientRows } = configIds.length
    ? await admin.from('alert_configs').select('id, sensor_id, email_recipients').in('id', configIds)
    : { data: [] };

  for (const row of (configRecipientRows ?? []) as {
    id: string; sensor_id: string; email_recipients: unknown;
  }[]) {
    const sensor = sensors.get(row.sensor_id);
    if (!sensor) continue;
    const customerId = sensor.gateways.customer_id;
    const perSensor = Array.isArray(row.email_recipients) ? (row.email_recipients as string[]) : [];
    const merged = new Set([
      ...(recipientsByCustomer.get(customerId) ?? []),
      ...perSensor.map((e) => e.toLowerCase()),
    ]);
    recipientsByCustomer.set(customerId, [...merged]);
  }

  const customerIdByAlert = new Map<string, string>();
  const subjectByAlert = new Map<string, string>();
  const hardwareIdByAlert = new Map<string, string | null>();
  const readingByAlert = new Map<string, string | null>();
  const rangeByAlert = new Map<string, string | null>();

  for (const alert of alerts) {
    if (alert.kind === 'gateway_offline' && alert.gateway_id) {
      const gateway = gateways.get(alert.gateway_id);
      if (!gateway) continue;
      customerIdByAlert.set(alert.id, gateway.customer_id);
      subjectByAlert.set(alert.id, gateway.name ?? 'Gateway');
      continue;
    }

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
