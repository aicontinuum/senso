// Freshness-based online/offline detection. A gateway or sensor that goes
// silent (loses power, hangs, drops network) never sends an explicit offline
// signal, so we treat stale data as offline based on how long it's been quiet.

// Heartbeat pulses every 60s; 5 min of silence (~4 missed pulses) means the
// gateway is genuinely unreachable rather than riding out a transient blip.
export const GATEWAY_STALE_MS = 5 * 60 * 1000;

// Sensors read + transmit every 15 min (deep sleep in between), sending each
// reading twice per wake so a single lost packet rarely loses the reading.
// 35 min of silence (a whole missed reading + margin) therefore means offline.
export const SENSOR_STALE_MS = 35 * 60 * 1000;

export function isGatewayOnline(
  isOnline: boolean,
  lastSeenAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!isOnline || !lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() <= GATEWAY_STALE_MS;
}

export function isSensorOnline(
  status: string,
  lastReadingAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status === "offline" || !lastReadingAt) return false;
  return now - new Date(lastReadingAt).getTime() <= SENSOR_STALE_MS;
}
