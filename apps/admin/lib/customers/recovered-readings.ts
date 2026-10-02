import type { createAdminClient } from '@/lib/supabase/admin';

// Readings a sensor sent from its memory after a gap, for the admin sensor
// page. Read here rather than in the page so the clock is consulted in a
// loader, not during render.

/** How far back the recovered-readings card looks. */
export const RECOVERED_WINDOW_DAYS = 7;

export type RecoveredReadings = {
  count: number;
  /** The latest recovered reading's time, when there is one. */
  latestAt: string | null;
};

export async function loadRecoveredReadings(
  admin: ReturnType<typeof createAdminClient>,
  sensorId: string,
): Promise<RecoveredReadings> {
  const since = new Date(Date.now() - RECOVERED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, count } = await admin
    .from('readings')
    .select('recorded_at', { count: 'exact' })
    .eq('sensor_id', sensorId)
    .eq('backfilled', true)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(1);
  return { count: count ?? 0, latestAt: data?.[0]?.recorded_at ?? null };
}
