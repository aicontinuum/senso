// How many sensors each customer actually has in service, for comparing
// against what their plan charges for. The plan's count is typed by hand;
// this one is counted from the device tables, so the two drifting apart is
// the signal that a sensor was added or removed without the plan following.
//
// Retired devices are excluded at both levels, the same rule the dashboard
// applies: a decommissioned sensor, or any sensor on a decommissioned
// gateway, is not in service.

import type { createAdminClient } from '@/lib/supabase/admin';

type SensorRow = { id: string; gateways: { customer_id: string } | null };

export async function loadInstalledSensorCounts(
  admin: ReturnType<typeof createAdminClient>,
  customerId?: string,
): Promise<Map<string, number>> {
  let query = admin
    .from('sensors')
    .select('id, gateways!inner(customer_id)')
    .is('decommissioned_at', null)
    .is('gateways.decommissioned_at', null);
  if (customerId) query = query.eq('gateways.customer_id', customerId);

  const { data, error } = await query;
  if (error) throw new Error(`sensors: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data as unknown as SensorRow[]) {
    const id = row.gateways?.customer_id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** A plan exists and its sensor count is not what is installed. No plan means
 *  nothing to compare, not a mismatch. */
export function sensorsMismatch(planCount: number, installed: number, hasPlan: boolean): boolean {
  return hasPlan && planCount !== installed;
}
