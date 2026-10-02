// The Devices page's view: every gateway and sensor the network server
// knows, each with what our own records say about it. Read on every page
// load, so the list is the truth right now; the network server being
// unreachable is reported, not hidden.

import type { createAdminClient } from '@/lib/supabase/admin';
import { chirpstackRegistry } from '@/lib/chirpstack';
import { listNetworkGateways, listNetworkSensors } from '@/lib/network/registry';

type Admin = ReturnType<typeof createAdminClient>;

export type DeviceLink = { customerId: string; customerName: string; branchName: string | null };

export type NetworkDeviceRow = {
  kind: 'gateway' | 'sensor';
  eui: string;
  name: string;
  /** When the network server last heard it; null means never. */
  lastSeenAt: string | null;
  /** The customer it is linked to in our records, or null. */
  link: DeviceLink | null;
};

export type NetworkDevices =
  | { state: 'unconfigured' }
  | { state: 'unreachable'; error: string }
  /** `now` is read here so the page never consults the clock in render. */
  | { state: 'ok'; rows: NetworkDeviceRow[]; now: number };

type LinkedGateway = { mac_address: string | null; customer_id: string; customers: { name: string } | null; branches: { name: string } | null };
type LinkedSensor = { hardware_id: string | null; gateways: LinkedGateway | null };

function toLink(g: LinkedGateway): DeviceLink {
  return { customerId: g.customer_id, customerName: g.customers?.name ?? '', branchName: g.branches?.name ?? null };
}

export async function loadNetworkDevices(admin: Admin): Promise<NetworkDevices> {
  const registry = chirpstackRegistry();
  if (!registry) return { state: 'unconfigured' };

  const [gateways, sensors, ours] = await Promise.all([
    listNetworkGateways(registry),
    listNetworkSensors(registry),
    Promise.all([
      admin.from('gateways').select('mac_address, customer_id, customers(name), branches(name)').is('decommissioned_at', null),
      admin.from('sensors').select('hardware_id, gateways!inner(mac_address, customer_id, customers(name), branches(name))').is('decommissioned_at', null),
    ]),
  ]);
  if (!gateways.ok) return { state: 'unreachable', error: gateways.error };
  if (!sensors.ok) return { state: 'unreachable', error: sensors.error };
  const [{ data: ourGateways, error: gError }, { data: ourSensors, error: sError }] = ours;
  if (gError) throw new Error(`${gError.code} ${gError.message}`);
  if (sError) throw new Error(`${sError.code} ${sError.message}`);

  const gatewayLinks = new Map<string, DeviceLink>();
  for (const g of (ourGateways ?? []) as unknown as LinkedGateway[]) {
    if (g.mac_address) gatewayLinks.set(g.mac_address.toLowerCase(), toLink(g));
  }
  const sensorLinks = new Map<string, DeviceLink>();
  for (const s of (ourSensors ?? []) as unknown as LinkedSensor[]) {
    if (s.hardware_id && s.gateways) sensorLinks.set(s.hardware_id.toLowerCase(), toLink(s.gateways));
  }

  const rows: NetworkDeviceRow[] = [
    ...gateways.data.map(g => ({ kind: 'gateway' as const, eui: g.gatewayId, name: g.name, lastSeenAt: g.lastSeenAt, link: gatewayLinks.get(g.gatewayId) ?? null })),
    ...sensors.data.map(s => ({ kind: 'sensor' as const, eui: s.devEui, name: s.name, lastSeenAt: s.lastSeenAt, link: sensorLinks.get(s.devEui) ?? null })),
  ];
  // Unlinked first: they are the ones waiting for a job.
  rows.sort((a, b) => Number(Boolean(a.link)) - Number(Boolean(b.link)) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return { state: 'ok', rows, now: Date.now() };
}
