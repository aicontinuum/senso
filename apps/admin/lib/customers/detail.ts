// Everything the admin customer page shows, for one customer. The clock is
// taken once here and returned, so every relative figure on the page agrees
// and the page component stays pure.

import type { createAdminClient } from '@/lib/supabase/admin';
import { isGatewayOnline, isSensorOnline, SENSOR_STALE_MS } from '@senso/status';
import { loadBranches } from '@/lib/branches/load';
import { loadGroupMembers, loadGroupOf, loadUnlinkedAccounts, type AccountRef, type GroupMember, type GroupRef } from '@/lib/groups/load';
import type { CustomerRow } from '@/components/customers/AccountInfoSection';
import type { GatewayRow } from '@/components/customers/GatewaysSection';
import type { SensorRow } from '@/components/customers/SensorsSection';
import type { Branch } from '@/types/branches';

type Admin = ReturnType<typeof createAdminClient>;

export type CustomerDetail = {
  now: number;
  customer: CustomerRow;
  branches: Branch[];
  gateways: GatewayRow[];
  sensors: SensorRow[];
  /** For a group: who it reads, and who it could add. Empty otherwise. */
  members: GroupMember[];
  candidates: AccountRef[];
  /** For a member: the group it belongs to. */
  groupOf: GroupRef | null;
};

type SensorSource = { id: string; name: string; status: string; gateway_id: string; commissioned_at: string | null };

export async function loadCustomerDetail(admin: Admin, id: string, now: number = Date.now()): Promise<CustomerDetail | null> {
  const { data: customer } = await admin
    .from('customers')
    .select('id, name, email, contact_name, phone, status, created_at, alert_recipients, is_group')
    .eq('id', id)
    .single();
  if (!customer) return null;

  // A group has no devices to load; its page is its members.
  if (customer.is_group) {
    const [members, candidates] = await Promise.all([loadGroupMembers(admin, id), loadUnlinkedAccounts(admin)]);
    return { now, customer, branches: [], gateways: [], sensors: [], members, candidates, groupOf: null };
  }

  const [branches, groupOf, { data: gateways }] = await Promise.all([
    loadBranches(admin, id),
    loadGroupOf(admin, id),
    admin
      .from('gateways')
      .select('id, name, branch_id, is_online, firmware_version, last_seen_at, mac_address')
      .eq('customer_id', id)
      .is('decommissioned_at', null)
      .order('created_at', { ascending: true }),
  ]);

  const gatewayIds = (gateways ?? []).map(g => g.id);

  // Retired sensors keep their readings for the compliance record but are not
  // listed as live devices.
  const { data: sensors } = gatewayIds.length > 0
    ? await admin.from('sensors').select('id, name, status, gateway_id, commissioned_at').in('gateway_id', gatewayIds).is('decommissioned_at', null)
    : { data: [] as SensorSource[] };

  // Freshness-based status, same rules as the customer site — the raw
  // is_online/status flags never flip for a device that dies silently.
  const sensorIds = (sensors ?? []).map(s => s.id);
  const freshReadingBySensor = new Map<string, string>();
  // Battery is the voltage on the latest reading, exactly as the customer site
  // shows it. `sensors.battery_level` is a leftover from the prototype kit that
  // nothing has written since the LoRaWAN migration. One small query per sensor,
  // because a single shared limit would let a busy sensor crowd a silent one's
  // last reading out of the window.
  const batteryBySensor = new Map<string, number | null>();
  if (sensorIds.length > 0) {
    const sinceStale = new Date(now - SENSOR_STALE_MS).toISOString();
    const [{ data: freshReadings }, latestReadings] = await Promise.all([
      admin
        .from('readings')
        .select('sensor_id, recorded_at')
        .in('sensor_id', sensorIds)
        .gte('recorded_at', sinceStale),
      Promise.all(sensorIds.map(sensorId =>
        admin
          .from('readings')
          .select('sensor_id, battery_v')
          .eq('sensor_id', sensorId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )),
    ]);
    for (const r of freshReadings ?? []) freshReadingBySensor.set(r.sensor_id, r.recorded_at);
    for (const { data } of latestReadings) {
      if (data) batteryBySensor.set(data.sensor_id, data.battery_v);
    }
  }

  return {
    now,
    customer,
    branches,
    members: [],
    candidates: [],
    groupOf,
    gateways: (gateways ?? []).map(g => ({ ...g, is_online: isGatewayOnline(g.is_online, g.last_seen_at) })),
    sensors: (sensors ?? []).map(s => ({
      ...s,
      status: isSensorOnline(s.status, freshReadingBySensor.get(s.id)) ? 'online' : 'offline',
      battery_v: batteryBySensor.get(s.id) ?? null,
    })),
  };
}
