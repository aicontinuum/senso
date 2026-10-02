// The one way this app talks to the network server: ChirpStack's REST API,
// reached through the same host as its dashboard (network-server/README.md,
// "Backfill from the sensor's memory"), with an API token from its own
// settings. Server-side only.
//
// Fail-closed like the ingest secret: unconfigured means the call is not
// made and the caller is told so, never a request to a guessed address.
// Every call answers a result, never throws: the network server being
// down is an ordinary outcome the caller decides about.

import { DATALOG_REPLY_INTERVAL_S } from '@/lib/constants';

/** Downlinks to an LHT65N go on this port. */
const DOWNLINK_FPORT = 1;
/** "Send me your stored readings between these times." */
const DATALOG_POLL_COMMAND = 0x31;
/** How long to wait for the network server before giving up. */
const REQUEST_TIMEOUT_MS = 8000;

/** gRPC status codes as the REST wrapper reports them. */
export const CHIRPSTACK_NOT_FOUND = 5;
export const CHIRPSTACK_ALREADY_EXISTS = 6;

export type ChirpStackConfig = { url: string; token: string };

/** Where new devices go: the one tenant, the one application, the one
 *  profile (README §8). Needed to register, not to poll or list. */
export type ChirpStackRegistry = ChirpStackConfig & { tenantId: string; applicationId: string; deviceProfileId: string };

export function chirpstackConfig(): ChirpStackConfig | null {
  const url = process.env.CHIRPSTACK_API_URL?.replace(/\/+$/, '');
  const token = process.env.CHIRPSTACK_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function chirpstackRegistry(): ChirpStackRegistry | null {
  const base = chirpstackConfig();
  const tenantId = process.env.CHIRPSTACK_TENANT_ID;
  const applicationId = process.env.CHIRPSTACK_APPLICATION_ID;
  const deviceProfileId = process.env.CHIRPSTACK_DEVICE_PROFILE_ID;
  return base && tenantId && applicationId && deviceProfileId
    ? { ...base, tenantId, applicationId, deviceProfileId }
    : null;
}

export type ChirpStackResult<T> =
  | { ok: true; data: T }
  /** The server answered with an error; `code` is its gRPC status. */
  | { ok: false; code: number; error: string }
  /** No usable answer: unreachable, timed out, or not JSON. */
  | { ok: false; code: null; error: string };

/** One request to the REST API. The body, when there is one, is JSON. */
export async function chirpstackRequest<T = unknown>(
  config: ChirpStackConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ChirpStackResult<T>> {
  try {
    const res = await fetch(`${config.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : {};
    if (res.ok) return { ok: true, data: data as T };
    const err = data as { code?: unknown; message?: unknown };
    return {
      ok: false,
      code: typeof err.code === 'number' ? err.code : -1,
      error: typeof err.message === 'string' ? err.message : `HTTP ${res.status}`,
    };
  } catch (error) {
    return { ok: false, code: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The poll command: start and end as unix seconds, then how many seconds
 *  the sensor waits between the frames of its answer. Verified by hand on
 *  sensor 2, 2026-10-02 (DEVLOG). */
export function datalogPollCommand(start: Date, end: Date): Uint8Array {
  const bytes = new Uint8Array(10);
  const view = new DataView(bytes.buffer);
  bytes[0] = DATALOG_POLL_COMMAND;
  view.setUint32(1, Math.floor(start.getTime() / 1000));
  view.setUint32(5, Math.floor(end.getTime() / 1000));
  bytes[9] = DATALOG_REPLY_INTERVAL_S;
  return bytes;
}

export type EnqueueResult = { ok: true; id: string } | { ok: false; error: string };

/** Queue a downlink for a device. ChirpStack holds it until the device next
 *  transmits (a class A device only listens right after it talks). */
export async function enqueueDownlink(config: ChirpStackConfig, devEui: string, bytes: Uint8Array): Promise<EnqueueResult> {
  const result = await chirpstackRequest<{ id?: unknown }>(config, 'POST', `/api/devices/${devEui}/queue`, {
    queueItem: { devEui, fPort: DOWNLINK_FPORT, confirmed: false, data: Buffer.from(bytes).toString('base64') },
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: typeof result.data.id === 'string' ? result.data.id : '' };
}
