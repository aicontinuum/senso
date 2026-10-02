import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { integrationSecretOk } from '@/lib/ingest-auth';
import { stampPlatform } from '@/lib/platform-status';
import { retry, describeError } from '@/lib/retry';
import { MAX_READING_AGE_MS, JOB_INGEST, BACKFILL_GAP_MS } from '@/lib/constants';
import { THRESHOLD_MIN_C, THRESHOLD_MAX_C } from '@senso/thresholds';
import { frameBytes, isDatalogFrame, parseDatalogFrame } from '@/lib/ingest/datalog';
import { requestBackfill, storeDatalog } from '@/lib/ingest/backfill';
import { chirpstackConfig } from '@/lib/chirpstack';

// Ingest endpoint for ChirpStack's HTTP integration (LoRaWAN).
//
// This route is a writer. It authenticates, validates, and stores the reading.
// It does not decide anything: the sensor's freshness stamp and the threshold
// verdict are made by the trigger on `readings` in the same transaction as the
// insert (20260910_alerting_v2_cutover.sql), so a reading cannot exist without
// its verdict and every path that inserts one gets the verdict for free.
//
// Payload contract and field mapping: network-server/UPLINK-FORMAT.md

/** Only fPort 2 carries a sensor reading, live or recovered from the
 *  sensor's memory. See UPLINK-FORMAT.md §4. */
const READING_FPORT = 2;

/** Every Qatar device is registered eu868; anything else is misconfigured. */
const EXPECTED_REGION = 'eu868';

/** Sanity bounds for a temperature reading, well outside any real
 *  fridge/freezer, and the same bounds a threshold may be set within. */
const MIN_TEMP_C = THRESHOLD_MIN_C;
const MAX_TEMP_C = THRESHOLD_MAX_C;

/** How far ahead of now a device timestamp may be before we distrust it. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type ChirpStackUplink = {
  deduplicationId?: string;
  time?: string;
  deviceInfo?: { devEui?: string; deviceName?: string };
  /** The raw frame, base64. Read directly for a datalog answer. */
  data?: string;
  fPort?: number;
  object?: Record<string, unknown>;
  rxInfo?: { gatewayId?: string; rssi?: number; snr?: number }[];
  txInfo?: { modulation?: { lora?: { spreadingFactor?: number } } };
  regionConfigId?: string;
};

/**
 * A reading that could not be stored, on the record. Ingest has no per-request
 * ledger — thousands of successes a day would say nothing — but a loss is the
 * one event worth a row, because ChirpStack will not re-send and the reading is
 * otherwise gone without a trace. Its own failure is logged and swallowed: it
 * must not turn a 503 into a crash.
 */
async function recordFailure(
  admin: ReturnType<typeof createAdminClient>,
  detail: { step: string; devEui: string; cause: string },
) {
  console.error('[ingest] reading lost', detail);
  const now = new Date().toISOString();
  const { error } = await admin
    .from('job_runs')
    .insert({ job: JOB_INGEST, started_at: now, finished_at: now, ok: false, detail });
  if (error) console.error('[ingest] could not record the loss', error);
}

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

  const admin = createAdminClient();

  // Any authenticated event from ChirpStack — join, status, ack, a reading — is
  // proof that the road from the gateways to this database is open right now.
  // Stamped before the event is filtered, so the platform's pulse reflects every
  // packet that arrived and not only the ones that became readings.
  await stampPlatform(admin, { last_uplink_at: new Date().toISOString() });

  // 2. ChirpStack posts every event type to the same URL, distinguished by
  //    `?event=`. Join/status/ack/txack are not readings — acknowledge and drop.
  //    200 rather than an error so ChirpStack doesn't retry a non-event forever.
  const event = new URL(request.url).searchParams.get('event');
  if (event && event !== 'up') {
    return NextResponse.json({ ignored: 'event', event });
  }

  // 3. Only fPort 2 carries readings: live ones, and the answers from a
  //    sensor's memory (step 5). fPort 5 is device status, with a different
  //    shape; it is dropped deliberately rather than half-handled.
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

  // 4. Reject readings from any device we don't already know. Sensors are
  //    pre-registered during onboarding, so an unknown DevEUI means a mis-scan, a
  //    stray, or someone else's device — it must never enter a customer's
  //    compliance record. 200 (not 4xx) because this is a permanent condition and
  //    retrying won't fix it; the warning is the signal.
  //
  //    The lookup's error is checked, and retried, because "no row" and "the
  //    request was dropped" are different answers that arrive as the same
  //    value. On 2026-09-13 an hour of one sensor's readings vanished this way:
  //    the Vercel → Supabase path dropped the lookup, the empty result read as
  //    "unknown device", and ChirpStack was told 200 so it never re-sent. A
  //    lookup that still fails after retries is a 503 and a ledger row —
  //    ChirpStack's HTTP integration does not retry, so the retries here are
  //    the only defence, and the row is the evidence when they are not enough.
  const { data: sensor, error: lookupError } = await retry(
    'ingest sensor lookup',
    () => admin
      .from('sensors')
      .select('id, gateway_id, commissioned_at, last_reading_at')
      .eq('hardware_id', devEui)
      .is('decommissioned_at', null)
      .maybeSingle(),
  );

  if (lookupError) {
    await recordFailure(admin, { step: 'sensor_lookup', devEui, cause: describeError(lookupError) });
    return NextResponse.json({ error: 'Could not look up device' }, { status: 503 });
  }

  if (!sensor) {
    console.warn(`[ingest] unregistered or retired DevEUI: ${devEui}`);
    return NextResponse.json({ ignored: 'unknown_device', devEui });
  }

  // 5. An answer from the sensor's memory. Same port as a live reading, told
  //    apart by its status byte; its readings carry their own times, so it
  //    never reaches the live path below, which would stamp them all "now".
  const frame = body.data ? frameBytes(body.data) : null;
  if (frame && isDatalogFrame(frame)) {
    const result = await storeDatalog(admin, sensor, parseDatalogFrame(frame), Date.now());
    if ('error' in result) {
      await recordFailure(admin, { step: 'backfill_store', devEui, cause: result.error });
      return NextResponse.json({ error: 'Could not store recovered readings' }, { status: 503 });
    }
    console.log(`[ingest] ${devEui}: recovered readings`, result);
    return NextResponse.json({ backfill: result, devEui });
  }

  // 6. Validate a live reading.
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

  // Timestamp is ChirpStack's receive time, bounded on both sides.
  //
  // Ahead of now: a bad clock writing a future `recorded_at` would, since that
  // column is the upsert conflict key, silently swallow the real reading for
  // that slot later — so it is clamped to now.
  //
  // Behind now: anything older than the window is refused outright. A retry
  // through an outage arrives within hours; a reading claiming to be from last
  // month is either a broken clock or someone holding the ingest secret trying
  // to re-file the past. The record is append-only and the past is not for
  // re-filing. 200, not 4xx: retrying will not make it younger.
  const nowMs = Date.now();
  const parsed = body.time ? Date.parse(body.time) : NaN;
  if (Number.isFinite(parsed) && parsed < nowMs - MAX_READING_AGE_MS) {
    console.warn(`[ingest] ${devEui}: reading timestamp ${body.time} is older than the window`);
    return NextResponse.json({ ignored: 'stale_reading', devEui });
  }
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
    dedup_id: body.deduplicationId ?? null,
  };

  // 7. Idempotent insert. Two indexes make a repeat harmless: (sensor_id,
  //    recorded_at), which the upsert names, and ChirpStack's own dedup_id,
  //    which surfaces as a unique violation and is treated as the same answer.
  //    The trigger on readings stamps the sensor and judges the thresholds
  //    inside this same statement.
  //    Retried for the same reason as the lookup. Safe to repeat: both unique
  //    indexes make a second arrival of the same reading a no-op, so a request
  //    that succeeded on the server but lost its answer cannot double-store.
  const { data: inserted, error: insertError } = await retry(
    'ingest reading upsert',
    () => admin
      .from('readings')
      .upsert(reading, { onConflict: 'sensor_id,recorded_at', ignoreDuplicates: true })
      .select('id'),
  );

  if (insertError && insertError.code !== '23505') {
    await recordFailure(admin, { step: 'reading_insert', devEui, cause: describeError(insertError) });
    return NextResponse.json({ error: 'Could not store reading' }, { status: 503 });
  }
  const duplicate = Boolean(insertError) || !inserted || inserted.length === 0;

  // Mark the receiving gateway(s) alive. This replaces the Pi's heartbeat.sh —
  // a gateway relaying uplinks is by definition reachable. Bookkeeping: a
  // failure here is retried and then logged, never returned.
  const gatewayIds = [...new Set((body.rxInfo ?? []).map(r => r.gatewayId).filter(Boolean))] as string[];
  if (gatewayIds.length > 0) {
    await retry(
      'gateway last_seen stamp',
      () => admin
        .from('gateways')
        .update({ is_online: true, last_seen_at: recordedAt })
        .in('mac_address', gatewayIds)
        .is('decommissioned_at', null),
    );
  }

  if (duplicate) {
    return NextResponse.json({ accepted: 0, duplicate: true });
  }

  // 8. A reading after a gap: ask the sensor for what it stored meanwhile.
  //    Only for a sensor in service, whose record matters, and only when the
  //    network server is configured; the answer comes back through step 5.
  const previousAt = sensor.last_reading_at ? Date.parse(sensor.last_reading_at) : NaN;
  const network = chirpstackConfig();
  if (network && sensor.commissioned_at !== null && Number.isFinite(previousAt)
      && Date.parse(recordedAt) - previousAt > BACKFILL_GAP_MS) {
    await requestBackfill(admin, network, devEui, new Date(previousAt), new Date(recordedAt));
  }

  // Stored, stamped and judged — all by the one insert. `notInService` is
  // informational: an uncommissioned sensor's reading is kept (the bench test
  // depends on watching it arrive) but the trigger raises nothing for it.
  return NextResponse.json({
    accepted: 1,
    devEui,
    temperature,
    ...(sensor.commissioned_at === null ? { notInService: true } : {}),
  });
}
