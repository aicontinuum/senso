// What the network server knows about our hardware: the gateways under the
// one tenant and the sensors under the one application, and the four
// changes the Devices page makes to them. Every function answers a
// ChirpStackResult; the routes turn those into words.

import {
  chirpstackRequest, datalogPollCommand, enqueueDownlink,
  type ChirpStackConfig, type ChirpStackRegistry, type ChirpStackResult,
} from '@/lib/chirpstack';
import { SENSOR_REPORTING_INTERVAL_MIN } from '@/lib/constants';

/** A page of a ChirpStack list; the lists here are small enough for one. */
const LIST_LIMIT = 1000;
/** The interval command: set the reporting period, in seconds, big-endian. */
const SET_INTERVAL_COMMAND = 0x01;
/** LoRaWAN 1.0.x: the device's AppKey is sent as the network key; the
 *  application key field exists for 1.1 and is left zero. */
const UNUSED_KEY = '0'.repeat(32);
/** ChirpStack wants a location on a gateway; ours are set by site, not GPS. */
const NO_LOCATION = { latitude: 0, longitude: 0, altitude: 0, source: 'UNKNOWN', accuracy: 0 };
/** How often a gateway reports its own stats, in seconds; ChirpStack's default. */
const GATEWAY_STATS_INTERVAL_S = 30;

export type NetworkGateway = {
  gatewayId: string;
  name: string;
  /** ISO instant, or null if it has never connected. */
  lastSeenAt: string | null;
};

export type NetworkSensor = {
  devEui: string;
  name: string;
  /** ISO instant, or null if it has never joined. */
  lastSeenAt: string | null;
};

type GatewayListItem = { gatewayId?: string; name?: string; lastSeenAt?: string | null };
type DeviceListItem = { devEui?: string; name?: string; lastSeenAt?: string | null };

export async function listNetworkGateways(config: ChirpStackRegistry): Promise<ChirpStackResult<NetworkGateway[]>> {
  const result = await chirpstackRequest<{ result?: GatewayListItem[] }>(
    config, 'GET', `/api/gateways?limit=${LIST_LIMIT}&tenantId=${config.tenantId}`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data.result ?? [])
      .filter((g): g is GatewayListItem & { gatewayId: string } => typeof g.gatewayId === 'string')
      .map(g => ({ gatewayId: g.gatewayId.toLowerCase(), name: g.name ?? '', lastSeenAt: g.lastSeenAt ?? null })),
  };
}

export async function listNetworkSensors(config: ChirpStackRegistry): Promise<ChirpStackResult<NetworkSensor[]>> {
  const result = await chirpstackRequest<{ result?: DeviceListItem[] }>(
    config, 'GET', `/api/devices?limit=${LIST_LIMIT}&applicationId=${config.applicationId}`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data.result ?? [])
      .filter((d): d is DeviceListItem & { devEui: string } => typeof d.devEui === 'string')
      .map(d => ({ devEui: d.devEui.toLowerCase(), name: d.name ?? '', lastSeenAt: d.lastSeenAt ?? null })),
  };
}

/** Whether the network server knows this gateway. */
export function gatewayExists(config: ChirpStackConfig, gatewayId: string): Promise<ChirpStackResult<unknown>> {
  return chirpstackRequest(config, 'GET', `/api/gateways/${gatewayId}`);
}

/** Whether the network server knows this sensor. */
export function sensorExists(config: ChirpStackConfig, devEui: string): Promise<ChirpStackResult<unknown>> {
  return chirpstackRequest(config, 'GET', `/api/devices/${devEui}`);
}

export function registerGateway(config: ChirpStackRegistry, gatewayId: string, name: string): Promise<ChirpStackResult<unknown>> {
  return chirpstackRequest(config, 'POST', '/api/gateways', {
    gateway: { gatewayId, name, tenantId: config.tenantId, location: NO_LOCATION, statsInterval: GATEWAY_STATS_INTERVAL_S, tags: {}, metadata: {} },
  });
}

export function removeGateway(config: ChirpStackConfig, gatewayId: string): Promise<ChirpStackResult<unknown>> {
  return chirpstackRequest(config, 'DELETE', `/api/gateways/${gatewayId}`);
}

/** Create the device, set its key, queue the interval. If the key cannot
 *  be set the device is removed again, so a half-registered sensor that
 *  could never join is not left behind. */
export async function registerSensor(
  config: ChirpStackRegistry, devEui: string, appKey: string, name: string,
): Promise<ChirpStackResult<{ intervalQueued: boolean }>> {
  const created = await chirpstackRequest(config, 'POST', '/api/devices', {
    device: {
      devEui, name, applicationId: config.applicationId, deviceProfileId: config.deviceProfileId,
      skipFcntCheck: false, isDisabled: false, variables: {}, tags: {},
    },
  });
  if (!created.ok) return created;

  const keyed = await chirpstackRequest(config, 'POST', `/api/devices/${devEui}/keys`, {
    deviceKeys: { devEui, nwkKey: appKey, appKey: UNUSED_KEY },
  });
  if (!keyed.ok) {
    await chirpstackRequest(config, 'DELETE', `/api/devices/${devEui}`);
    return keyed;
  }

  const interval = await queueReportingInterval(config, devEui);
  return { ok: true, data: { intervalQueued: interval.ok } };
}

export function removeSensor(config: ChirpStackConfig, devEui: string): Promise<ChirpStackResult<unknown>> {
  return chirpstackRequest(config, 'DELETE', `/api/devices/${devEui}`);
}

/** Tell the sensor to report every SENSOR_REPORTING_INTERVAL_MIN minutes.
 *  Devices ship at 20; the command waits for the sensor's next uplink. */
export function queueReportingInterval(config: ChirpStackConfig, devEui: string) {
  const seconds = SENSOR_REPORTING_INTERVAL_MIN * 60;
  const bytes = new Uint8Array([SET_INTERVAL_COMMAND, (seconds >> 16) & 0xff, (seconds >> 8) & 0xff, seconds & 0xff]);
  return enqueueDownlink(config, devEui, bytes);
}

export { datalogPollCommand };
