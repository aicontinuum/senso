// Filling a gap in a sensor's record from the sensor's own memory.
//
// Two halves, both called from the ingest route. `requestBackfill` runs when
// a live reading arrives after a gap: it queues the poll command so the
// sensor sends what it stored meanwhile. `storeDatalog` runs when that
// answer arrives: it files the stored readings with the times the sensor
// took them. Neither touches alerts. The offline alert opened and closed on
// the live readings, and the trigger on `readings` ignores anything older
// than the sensor's latest, so a recovered reading can neither open nor
// close one (20260910_alerting_v2_cutover.sql, block 3).
//
// The sensor's clock is its own. Sensor 2 ran six minutes fast on
// 2026-10-02, so a stored reading is matched to what is already on record
// by proximity: within BACKFILL_MATCH_WINDOW_MS of an existing reading it is
// the same measurement seen twice and is dropped. That also makes a second
// answer to the same poll, or an overlapping poll, harmless.

import { THRESHOLD_MAX_C, THRESHOLD_MIN_C } from '@senso/thresholds';
import type { createAdminClient } from '@/lib/supabase/admin';
import { datalogPollCommand, enqueueDownlink, type ChirpStackConfig } from '@/lib/chirpstack';
import { retry, describeError } from '@/lib/retry';
import { BACKFILL_CLOCK_SLACK_MS, BACKFILL_MATCH_WINDOW_MS, BACKFILL_MAX_AGE_MS, JOB_BACKFILL } from '@/lib/constants';
import type { DatalogRecord } from '@/lib/ingest/datalog';

type Admin = ReturnType<typeof createAdminClient>;

export type BackfillSensor = {
  id: string;
  /** The latest live reading's time, or null if there has never been one. */
  last_reading_at: string | null;
};

export type StoreResult = {
  stored: number;
  /** Outside the accepted age, in the future, out of bounds, or newer than the latest live reading. */
  rejected: number;
  /** Already on record, by proximity. */
  alreadyKnown: number;
};

/** File the stored readings a sensor sent back. */
export async function storeDatalog(
  admin: Admin,
  sensor: BackfillSensor,
  records: DatalogRecord[],
  nowMs: number,
): Promise<StoreResult | { error: string }> {
  const latestLive = sensor.last_reading_at ? Date.parse(sensor.last_reading_at) : null;
  const oldest = nowMs - BACKFILL_MAX_AGE_MS;

  const candidates = records.filter(r => {
    const t = r.recordedAt.getTime();
    return Number.isFinite(t)
      && t >= oldest
      && latestLive !== null && t < latestLive
      && r.temperature >= THRESHOLD_MIN_C && r.temperature <= THRESHOLD_MAX_C;
  });
  const rejected = records.length - candidates.length;
  if (candidates.length === 0) return { stored: 0, rejected, alreadyKnown: 0 };

  const times = candidates.map(r => r.recordedAt.getTime());
  const from = new Date(Math.min(...times) - BACKFILL_MATCH_WINDOW_MS).toISOString();
  const to = new Date(Math.max(...times) + BACKFILL_MATCH_WINDOW_MS).toISOString();
  const { data: existing, error: readError } = await retry(
    'backfill existing readings',
    () => admin.from('readings').select('recorded_at').eq('sensor_id', sensor.id).gte('recorded_at', from).lte('recorded_at', to),
  );
  if (readError) return { error: describeError(readError) };

  const known = (existing ?? []).map(r => Date.parse(r.recorded_at));
  const fresh: DatalogRecord[] = [];
  for (const r of candidates) {
    const t = r.recordedAt.getTime();
    const near = (k: number) => Math.abs(k - t) < BACKFILL_MATCH_WINDOW_MS;
    if (known.some(near) || fresh.some(f => near(f.recordedAt.getTime()))) continue;
    fresh.push(r);
  }
  if (fresh.length === 0) return { stored: 0, rejected, alreadyKnown: candidates.length };

  const rows = fresh.map(r => ({
    sensor_id: sensor.id,
    temperature: r.temperature,
    humidity: r.humidity,
    recorded_at: r.recordedAt.toISOString(),
    backfilled: true,
  }));
  const { error: insertError } = await retry(
    'backfill reading upsert',
    () => admin.from('readings').upsert(rows, { onConflict: 'sensor_id,recorded_at', ignoreDuplicates: true }),
  );
  if (insertError) return { error: describeError(insertError) };

  return { stored: fresh.length, rejected, alreadyKnown: candidates.length - fresh.length };
}

/** Ask the sensor for what it stored between its previous live reading and
 *  this one. Best effort: a failure is logged and recorded, never returned,
 *  because the live reading that revealed the gap is already stored. */
export async function requestBackfill(
  admin: Admin,
  config: ChirpStackConfig,
  devEui: string,
  previousAt: Date,
  currentAt: Date,
): Promise<void> {
  const oldest = currentAt.getTime() - BACKFILL_MAX_AGE_MS;
  const start = new Date(Math.max(previousAt.getTime() - BACKFILL_CLOCK_SLACK_MS, oldest));
  const end = new Date(currentAt.getTime() + BACKFILL_CLOCK_SLACK_MS);

  const result = await enqueueDownlink(config, devEui, datalogPollCommand(start, end));
  if (result.ok) {
    console.log(`[backfill] asked ${devEui} for ${start.toISOString()} – ${end.toISOString()}`);
    return;
  }
  console.error('[backfill] could not queue the request', { devEui, error: result.error });
  const now = new Date().toISOString();
  const { error } = await admin.from('job_runs').insert({
    job: JOB_BACKFILL, started_at: now, finished_at: now, ok: false,
    detail: { devEui, from: start.toISOString(), to: end.toISOString(), cause: result.error },
  });
  if (error) console.error('[backfill] could not record the failure', error);
}
