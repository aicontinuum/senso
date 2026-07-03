// Freshness-based online/offline detection. A gateway or sensor that goes
// silent (loses power, hangs, drops network) never sends an explicit offline
// signal, so we treat stale data as offline based on how long it's been quiet.

export const GATEWAY_STALE_MS = 5 * 60 * 1000; // gateway offline after 5 min of silence
export const SENSOR_STALE_MS = 20 * 60 * 1000; // sensor offline after 20 min of silence

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
