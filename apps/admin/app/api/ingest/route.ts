import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { integrationSecretOk } from '@/lib/ingest-auth';

// Ingest endpoint for ChirpStack's HTTP integration (LoRaWAN).
//
// Replaces the old Raspberry Pi forwarder format
// (`{mac_address, readings:[{hardware_id, temperature, recorded_at}]}`), which is
// gone along with the prototype stack. Payload contract and field mapping:
// network-server/UPLINK-FORMAT.md

const COOLDOWN_MS = 30 * 60 * 1000;

/** Only fPort 2 carries a sensor reading. See UPLINK-FORMAT.md §4. */
const READING_FPORT = 2;

/** Every Qatar device is registered eu868; anything else is misconfigured. */
const EXPECTED_REGION = 'eu868';

/** Sanity bounds for a temperature reading, well outside any real fridge/freezer. */
const MIN_TEMP_C = -80;
const MAX_TEMP_C = 100;

/** How far ahead of now a device timestamp may be before we distrust it. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type ChirpStackUplink = {
  deduplicationId?: string;
  time?: string;
  deviceInfo?: { devEui?: string; deviceName?: string };
  fPort?: number;
  object?: Record<string, unknown>;
  rxInfo?: { gatewayId?: string; rssi?: number; snr?: number }[];
  txInfo?: { modulation?: { lora?: { spreadingFactor?: number } } };
  regionConfigId?: string;
};

/** Decoders sometimes emit numbers as strings; coerce and reject anything unusable. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  // 1. Authenticate before doing anything else.
  if (!integrationSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ChirpStackUplink;
  try {
    body = await request.json() as ChirpStackUplink;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  // 2. ChirpStack posts every event type to the same URL, distinguished by
  //    `?event=`. Join/status/ack/txack are not readings — acknowledge and drop.
  //    200 rather than an error so ChirpStack doesn't retry a non-event forever.
  const event = new URL(request.url).searchParams.get('event');
  if (event && event !== 'up') {
    return NextResponse.json({ ignored: 'event', event });
  }

  // 3. Only fPort 2 is a sensor reading. fPort 5 is device status and fPort 3 is
  //    datalog backfill — both have a different payload shape, and fPort 3 carries
  //    its own historical timestamps, so parsing either as a normal uplink would
  //    write wrong data. Dropped deliberately rather than half-handled.
  if (body.fPort !== READING_FPORT) {
    return NextResponse.json({ ignored: 'fport', fPort: body.fPort ?? null });
  }

  if (body.regionConfigId && body.regionConfigId !== EXPECTED_REGION) {
    console.warn(`[ingest] unexpected region ${body.regionConfigId} for ${body.deviceInfo?.devEui}`);
    return NextResponse.json({ ignored: 'region', region: body.regionConfigId });
  }

  const devEui = body.deviceInfo?.devEui?.trim().toLowerCase();
  if (!devEui) {
    return NextResponse.json({ error: 'deviceInfo.devEui is required' }, { status: 400 });
  }

  // 4. Validate the payload before spending a database round-trip on it.
  //
  //    TempC_DS is the external probe — the value inside the fridge, and the one
  //    the compliance record is about. TempC_SHT is the unit's internal sensor
  //    reading the room outside it. Confusing them silently reports room
  //    temperature while a freezer fails.
  const temperature = num(body.object?.TempC_DS);
  if (temperature === null) {
    console.warn(`[ingest] ${devEui}: missing TempC_DS — external probe likely unseated`);
    return NextResponse.json({ ignored: 'no_probe_reading', devEui });
  }
  if (temperature < MIN_TEMP_C || temperature > MAX_TEMP_C) {
    console.warn(`[ingest] ${devEui}: temperature ${temperature} out of sane bounds`);
    return NextResponse.json({ ignored: 'implausible_temperature', devEui });
  }

  const admin = createAdminClient();

  // 5. Reject readings from any device we don't already know. Sensors are
  //    pre-registered during onboarding, so an unknown DevEUI means a mis-scan, a
  //    stray, or someone else's device — it must never enter a customer's
  //    compliance record. 200 (not 4xx) because this is a permanent condition and
  //    retrying won't fix it; the warning is the signal.
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, gateway_id')
    .eq('hardware_id', devEui)
    .is('decommissioned_at', null)
    .maybeSingle();

  if (!sensor) {
    console.warn(`[ingest] unregistered or retired DevEUI: ${devEui}`);
    return NextResponse.json({ ignored: 'unknown_device', devEui });
  }

  // Timestamp is ChirpStack's receive time. Guard against a bad clock writing a
  // future `recorded_at`: since that column is the upsert conflict key, a future
  // row would silently swallow the real reading for that slot later.
  const nowMs = Date.now();
  const parsed = body.time ? Date.parse(body.time) : NaN;
  const recordedAt = Number.isFinite(parsed) && parsed <= nowMs + MAX_CLOCK_SKEW_MS
    ? new Date(parsed).toISOString()
    : new Date(nowMs).toISOString();

  const rx = body.rxInfo?.[0];

  const reading = {
    sensor_id: sensor.id,
    temperature,
    humidity: num(body.object?.Hum_SHT),
    battery_v: num(body.object?.BatV),
    rssi: rx?.rssi ?? null,
    snr: rx?.snr ?? null,
    spreading_factor: body.txInfo?.modulation?.lora?.spreadingFactor ?? null,
    recorded_at: recordedAt,
  };

  // 6. Idempotent insert. ChirpStack already de-duplicates the same uplink heard by
  //    multiple gateways, so a repeat here means an HTTP retry — which carries the
  //    same `time`, so the unique (sensor_id, recorded_at) index absorbs it.
  const { data: inserted, error: insertError } = await admin
    .from('readings')
    .upsert(reading, { onConflict: 'sensor_id,recorded_at', ignoreDuplicates: true })
    .select('id');

  if (insertError) {
    console.error('[ingest] insert failed', insertError);
    return NextResponse.json({ error: 'Could not store reading' }, { status: 500 });
  }

  // Mark the receiving gateway(s) alive. This replaces the Pi's heartbeat.sh —
  // a gateway relaying uplinks is by definition reachable.
  const gatewayIds = [...new Set((body.rxInfo ?? []).map(r => r.gatewayId).filter(Boolean))] as string[];
  if (gatewayIds.length > 0) {
    await admin
      .from('gateways')
      .update({ is_online: true, last_seen_at: recordedAt })
      .in('mac_address', gatewayIds)
      .is('decommissioned_at', null);
  }

  // Already stored (a retry) — don't re-run alerts off a duplicate.
  if (!inserted || inserted.length === 0) {
    return NextResponse.json({ accepted: 0, duplicate: true });
  }

  const readingId = inserted[0].id;
  await admin.from('sensors').update({ status: 'online' }).eq('id', sensor.id);

  // 7. Threshold evaluation — unchanged in behaviour from the previous ingest,
  //    now linked to the reading that triggered it.
  const { data: configs } = await admin
    .from('alert_configs')
    .select('id, type, threshold')
    .eq('sensor_id', sensor.id);

  for (const config of configs ?? []) {
    const breaching =
      (config.type === 'min' && temperature < config.threshold) ||
      (config.type === 'max' && temperature > config.threshold);

    if (breaching) {
      const { data: existing } = await admin
        .from('alert_logs')
        .select('id, triggered_at')
        .eq('alert_config_id', config.id)
        .eq('is_resolved', false)
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await admin.from('alert_logs').insert({
          alert_config_id: config.id,
          reading_id: readingId,
          triggered_at: recordedAt,
          is_resolved: false,
        });
      } else if (nowMs - new Date(existing.triggered_at).getTime() > COOLDOWN_MS) {
        await admin.from('alert_logs').update({ is_resolved: true }).eq('id', existing.id);
        await admin.from('alert_logs').insert({
          alert_config_id: config.id,
          reading_id: readingId,
          triggered_at: recordedAt,
          is_resolved: false,
        });
      }
      // else: within cooldown — already alerted, stay quiet
    } else {
      await admin
        .from('alert_logs')
        .update({ is_resolved: true })
        .eq('alert_config_id', config.id)
        .eq('is_resolved', false);
    }
  }

  return NextResponse.json({ accepted: 1, devEui, temperature });
}
