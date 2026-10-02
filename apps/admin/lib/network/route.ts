// What every network route does around its own call: find the registry
// configuration or say it is missing, turn a ChirpStack answer into words
// or a thrown error, and check whether our own records still link a
// device to a customer.

import type { createAdminClient } from '@/lib/supabase/admin';
import { BillingRuleError, NETWORK_NOT_CONFIGURED, NetworkServerError } from '@/lib/billing/route-helpers';
import {
  CHIRPSTACK_ALREADY_EXISTS, CHIRPSTACK_NOT_FOUND, chirpstackRegistry,
  type ChirpStackRegistry, type ChirpStackResult,
} from '@/lib/chirpstack';

type Admin = ReturnType<typeof createAdminClient>;

/** The registry configuration, or a 409 in words: an unconnected network
 *  server is a state the office can fix, not a server fault. */
export function requireRegistry(): ChirpStackRegistry {
  const registry = chirpstackRegistry();
  if (!registry) throw new BillingRuleError(NETWORK_NOT_CONFIGURED);
  return registry;
}

/** The data of a good answer. A refusal the office can act on (already
 *  registered, not found) becomes a 409 in words; anything else is the
 *  network server's problem and a 502. */
export function unwrap<T>(result: ChirpStackResult<T>, words: { exists?: string; missing?: string } = {}): T {
  if (result.ok) return result.data;
  if (result.code === CHIRPSTACK_ALREADY_EXISTS) throw new BillingRuleError(words.exists ?? 'Already registered on the network server');
  if (result.code === CHIRPSTACK_NOT_FOUND) throw new BillingRuleError(words.missing ?? 'Not found on the network server');
  throw new NetworkServerError(`${result.code ?? 'unreachable'}: ${result.error}`);
}

export type LiveLink = { customerName: string };

/** The customer a live gateway with this EUI is linked to, if any. */
export async function gatewayLink(admin: Admin, gatewayId: string): Promise<LiveLink | null> {
  const { data, error } = await admin
    .from('gateways').select('customers(name)').eq('mac_address', gatewayId).is('decommissioned_at', null).maybeSingle();
  if (error) throw new Error(`${error.code} ${error.message}`);
  const customer = data?.customers as unknown as { name: string } | null;
  return customer ? { customerName: customer.name } : null;
}

/** The customer a live sensor with this DevEUI is linked to, if any. */
export async function sensorLink(admin: Admin, devEui: string): Promise<LiveLink | null> {
  const { data, error } = await admin
    .from('sensors').select('gateways!inner(customers(name))').eq('hardware_id', devEui).is('decommissioned_at', null).maybeSingle();
  if (error) throw new Error(`${error.code} ${error.message}`);
  const gateway = data?.gateways as unknown as { customers: { name: string } | null } | null;
  return gateway?.customers ? { customerName: gateway.customers.name } : null;
}

export function stillLinkedMessage(kind: 'gateway' | 'sensor', link: LiveLink): string {
  return `This ${kind} is linked to ${link.customerName}. Unlink it on the customer's page first.`;
}
