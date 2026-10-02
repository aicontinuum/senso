// The devices waiting for a customer: registered on the network server
// and not linked to anyone in our records. The customer page's Link
// gateway and Add sensor forms offer these instead of a typed EUI, so a
// device cannot be linked before it exists on the network, and a typo
// cannot produce one that "never comes online".

import type { createAdminClient } from '@/lib/supabase/admin';
import { chirpstackRegistry } from '@/lib/chirpstack';
import { listNetworkGateways, listNetworkSensors } from '@/lib/network/registry';

export type AvailableDevice = { eui: string; name: string };

export type AvailableDevices =
  /** The network server is not connected or did not answer; the forms say so. */
  | { state: 'unavailable' }
  | { state: 'ok'; gateways: AvailableDevice[]; sensors: AvailableDevice[] };

function unlinked(registered: { eui: string; name: string }[], taken: Set<string>): AvailableDevice[] {
  return registered.filter(d => !taken.has(d.eui)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAvailableDevices(admin: ReturnType<typeof createAdminClient>): Promise<AvailableDevices> {
  const registry = chirpstackRegistry();
  if (!registry) return { state: 'unavailable' };

  const [gateways, sensors, { data: ourGateways, error: gError }, { data: ourSensors, error: sError }] = await Promise.all([
    listNetworkGateways(registry),
    listNetworkSensors(registry),
    admin.from('gateways').select('mac_address').is('decommissioned_at', null),
    admin.from('sensors').select('hardware_id').is('decommissioned_at', null),
  ]);
  if (!gateways.ok || !sensors.ok) return { state: 'unavailable' };
  if (gError) throw new Error(`${gError.code} ${gError.message}`);
  if (sError) throw new Error(`${sError.code} ${sError.message}`);

  const takenGateways = new Set((ourGateways ?? []).map(g => g.mac_address?.toLowerCase()).filter(Boolean));
  const takenSensors = new Set((ourSensors ?? []).map(s => s.hardware_id?.toLowerCase()).filter(Boolean));
  return {
    state: 'ok',
    gateways: unlinked(gateways.data.map(g => ({ eui: g.gatewayId, name: g.name })), takenGateways),
    sensors: unlinked(sensors.data.map(s => ({ eui: s.devEui, name: s.name })), takenSensors),
  };
}
