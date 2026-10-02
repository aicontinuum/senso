// The one way this app talks to the network server: ChirpStack's REST API,
// reached through the same host as its dashboard (network-server/README.md,
// "Backfill from the sensor's memory"), with an API token from its own
// settings. Server-side only.
//
// Fail-closed like the ingest secret: unconfigured means the call is not
// made and the caller is told so, never a request to a guessed address.

import { DATALOG_REPLY_INTERVAL_S } from '@/lib/constants';

/** Downlinks to an LHT65N go on this port. */
const DOWNLINK_FPORT = 1;
/** "Send me your stored readings between these times." */
const DATALOG_POLL_COMMAND = 0x31;

export type ChirpStackConfig = { url: string; token: string };

export function chirpstackConfig(): ChirpStackConfig | null {
  const url = process.env.CHIRPSTACK_API_URL?.replace(/\/+$/, '');
  const token = process.env.CHIRPSTACK_API_TOKEN;
  return url && token ? { url, token } : null;
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
  try {
    const res = await fetch(`${config.url}/api/devices/${devEui}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({
        queueItem: { devEui, fPort: DOWNLINK_FPORT, confirmed: false, data: Buffer.from(bytes).toString('base64') },
      }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof body?.id === 'string' ? body.id : '' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
