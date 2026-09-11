// The platform's own pulse: is Senso's infrastructure alive?
//
// `platform_status` is one row of last-seen stamps. This module owns the shape
// of that row, the rules for turning stamps into a status, and the one write
// path every stamper uses. The admin dashboard reads it now; from phase 4 the
// offline sweep reads it too, so that an outage on our side is never reported
// to a customer as their fridge going quiet.

import { SENSOR_STALE_MS, formatAgo } from '@senso/status';
import type { createAdminClient } from '@/lib/supabase/admin';
import { VPS_PULSE_STALE_MS, JOB_RUN_STALE_MS } from '@/lib/constants';

export type PlatformStatusRow = {
  vps_last_seen_at: string | null;
  chirpstack_ok: boolean | null;
  last_uplink_at: string | null;
  sweep_last_ok_at: string | null;
  sender_last_ok_at: string | null;
  last_customer_email_at: string | null;
};

export const PLATFORM_STATUS_COLUMNS =
  'vps_last_seen_at, chirpstack_ok, last_uplink_at, sweep_last_ok_at, sender_last_ok_at, last_customer_email_at';

export type PlatformLevel = 'ok' | 'late' | 'down';

export type PlatformCheck = {
  label: string;
  at: string | null;
  /** Null when the stamp has no freshness rule of its own (informational). */
  staleAfterMs: number | null;
  level: PlatformLevel;
};

export type PlatformAssessment = {
  level: PlatformLevel;
  checks: PlatformCheck[];
  /** One line naming what is wrong, or null when everything is inside its threshold. */
  reason: string | null;
};

function ageMs(at: string | null, now: number): number | null {
  if (!at) return null;
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? now - t : null;
}

function levelFor(at: string | null, staleAfterMs: number, now: number, whenStale: PlatformLevel): PlatformLevel {
  const age = ageMs(at, now);
  if (age === null) return whenStale;
  return age <= staleAfterMs ? 'ok' : whenStale;
}

/**
 * The rules, in one place.
 *
 * Down: the VPS has not pulsed inside its window, or its last pulse said
 * ChirpStack was not answering. Both are direct signals from the box itself.
 *
 * Late: a scheduled job has not completed inside its window. Alerts are still
 * being recorded; they are not yet being sent.
 *
 * The uplink stamp is deliberately not a "down" signal: with a small fleet it is
 * only as fresh as the last sensor to transmit, so it can trail by a whole
 * reading interval on a healthy day. It is shown, and it turns late past the
 * sensor window, because a stale uplink with a fresh pulse points at the radio
 * side rather than the server side.
 */
export function assessPlatform(row: PlatformStatusRow | null, now: number = Date.now()): PlatformAssessment {
  const r = row ?? {
    vps_last_seen_at: null, chirpstack_ok: null, last_uplink_at: null,
    sweep_last_ok_at: null, sender_last_ok_at: null, last_customer_email_at: null,
  };

  const vps = levelFor(r.vps_last_seen_at, VPS_PULSE_STALE_MS, now, 'down');
  const chirpstack: PlatformLevel = vps === 'down' ? 'down' : r.chirpstack_ok === false ? 'down' : 'ok';
  const uplink = levelFor(r.last_uplink_at, SENSOR_STALE_MS, now, 'late');
  const sweep = levelFor(r.sweep_last_ok_at, JOB_RUN_STALE_MS, now, 'late');
  const sender = levelFor(r.sender_last_ok_at, JOB_RUN_STALE_MS, now, 'late');

  const checks: PlatformCheck[] = [
    { label: 'VPS pulse', at: r.vps_last_seen_at, staleAfterMs: VPS_PULSE_STALE_MS, level: vps },
    { label: 'ChirpStack', at: r.vps_last_seen_at, staleAfterMs: null, level: chirpstack },
    { label: 'Last uplink received', at: r.last_uplink_at, staleAfterMs: SENSOR_STALE_MS, level: uplink },
    { label: 'Last offline sweep', at: r.sweep_last_ok_at, staleAfterMs: JOB_RUN_STALE_MS, level: sweep },
    { label: 'Last email run', at: r.sender_last_ok_at, staleAfterMs: JOB_RUN_STALE_MS, level: sender },
    { label: 'Last customer email', at: r.last_customer_email_at, staleAfterMs: null, level: 'ok' },
  ];

  let level: PlatformLevel = 'ok';
  let reason: string | null = null;
  if (vps === 'down') {
    level = 'down';
    reason = r.vps_last_seen_at ? 'The VPS has stopped pulsing.' : 'The VPS has never pulsed.';
  } else if (chirpstack === 'down') {
    level = 'down';
    reason = 'The VPS is up but ChirpStack is not answering.';
  } else if (sweep === 'late' || sender === 'late') {
    level = 'late';
    reason = 'The alert job has not completed recently. Breaches are recorded but not yet sent.';
  } else if (uplink === 'late') {
    level = 'late';
    reason = 'No uplink from any device inside the sensor window.';
  }

  return { level, checks, reason };
}

/**
 * What to print for one check. Every stamp is a relative time except
 * ChirpStack, which is a yes/no reported inside the pulse and has no time of
 * its own. Shared by the dashboard card and the ops email so they never
 * disagree about the same row.
 */
export function formatCheck(check: PlatformCheck, row: PlatformStatusRow | null, now: number = Date.now()): string {
  if (check.label !== 'ChirpStack') return formatAgo(check.at, now);
  const ok = row?.chirpstack_ok ?? null;
  if (check.level === 'down' && ok === false) return 'not answering';
  if (check.level === 'down') return 'unknown';
  if (ok === null) return 'not reported';
  return 'answering';
}

// The relative-time formatter lives in @senso/status so both sites word it the
// same way; re-exported here for the admin callers that already import it.
export { formatAgo } from '@senso/status';

/**
 * The one write path. Every stamper goes through here so a failure is logged
 * the same way everywhere and never fails the caller: a stamp is bookkeeping,
 * and losing one must never turn a reading or an email into an error.
 */
export async function stampPlatform(
  admin: ReturnType<typeof createAdminClient>,
  patch: Partial<PlatformStatusRow>,
): Promise<void> {
  const { error } = await admin.from('platform_status').update(patch).eq('id', true);
  if (error) console.error('[platform] could not stamp platform_status', { patch: Object.keys(patch), error });
}
