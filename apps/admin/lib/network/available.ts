// The sensors waiting for a customer: registered on the network server
// and not linked to anyone in our records. The customer page's Add sensor
// form offers these instead of a typed DevEUI, so a sensor cannot be
// linked before it exists on the network, and a typo cannot produce one
// that "never comes online".

import type { createAdminClient } from '@/lib/supabase/admin';
import { chirpstackRegistry } from '@/lib/chirpstack';
import { listNetworkSensors } from '@/lib/network/registry';

export type AvailableSensor = { devEui: string; name: string };

export type AvailableSensors =
  /** The network server is not connected or did not answer; the form says so. */
  | { state: 'unavailable' }
  | { state: 'ok'; sensors: AvailableSensor[] };

export async function loadAvailableSensors(admin: ReturnType<typeof createAdminClient>): Promise<AvailableSensors> {
  const registry = chirpstackRegistry();
  if (!registry) return { state: 'unavailable' };

  const [registered, { data: linked, error }] = await Promise.all([
    listNetworkSensors(registry),
    admin.from('sensors').select('hardware_id').is('decommissioned_at', null),
  ]);
  if (!registered.ok) return { state: 'unavailable' };
  if (error) throw new Error(`${error.code} ${error.message}`);

  const taken = new Set((linked ?? []).map(s => s.hardware_id?.toLowerCase()).filter(Boolean));
  return {
    state: 'ok',
    sensors: registered.data
      .filter(s => !taken.has(s.devEui))
      .map(s => ({ devEui: s.devEui, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
