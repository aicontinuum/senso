// Linking a device to a customer first checks the network server knows it,
// so a typo on the customer page can never produce a sensor that "never
// comes online". With the network server unconfigured the check is
// skipped, as before; with it unreachable the link is refused, because
// an unverified link is the mistake this exists to prevent.

import { BillingRuleError, NetworkServerError } from '@/lib/billing/route-helpers';
import { CHIRPSTACK_NOT_FOUND, chirpstackConfig } from '@/lib/chirpstack';
import { gatewayExists, sensorExists } from '@/lib/network/registry';

const NOT_REGISTERED = 'is not registered on the network server. Register it on the Devices page first.';

export async function requireRegisteredGateway(gatewayId: string): Promise<void> {
  const config = chirpstackConfig();
  if (!config) return;
  const result = await gatewayExists(config, gatewayId);
  if (result.ok) return;
  if (result.code === CHIRPSTACK_NOT_FOUND) throw new BillingRuleError(`This gateway ${NOT_REGISTERED}`);
  throw new NetworkServerError(`${result.code ?? 'unreachable'}: ${result.error}`);
}

export async function requireRegisteredSensor(devEui: string): Promise<void> {
  const config = chirpstackConfig();
  if (!config) return;
  const result = await sensorExists(config, devEui);
  if (result.ok) return;
  if (result.code === CHIRPSTACK_NOT_FOUND) throw new BillingRuleError(`This sensor ${NOT_REGISTERED}`);
  throw new NetworkServerError(`${result.code ?? 'unreachable'}: ${result.error}`);
}
