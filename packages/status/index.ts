// Freshness-based online/offline detection. A gateway or sensor that goes
// silent (loses power, hangs, drops network) never sends an explicit offline
// signal, so we treat stale data as offline based on how long it's been quiet.

// Sensors transmit every 15 min; 35 min of silence (a whole missed reading plus
// margin) means offline.
export const SENSOR_STALE_MS = 35 * 60 * 1000;

// Gateways are stamped alive by the uplinks they relay, so their liveness rides
// on the same 15-min cadence and needs the same tolerance.
//
// This was 5 min when the Pi ran `heartbeat.sh` every 60s. LoRaWAN gateways don't
// run our software — they only forward packets — so that dedicated pulse is gone.
// Leaving the threshold at 5 min would flag every gateway offline between uplinks.
//
// The cost is honest: a genuinely dead gateway now takes ~35 min to show up
// instead of ~5. The better fix is to read gateway state from ChirpStack's own
// gateway API (it tracks its own stats interval, currently 30s) rather than
// inferring it from uplinks — see MIGRATION.md.
export const GATEWAY_STALE_MS = SENSOR_STALE_MS;

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

// ── Battery ────────────────────────────────────────────────────────────────
//
// Reported as volts (`BatV`) on every uplink — not as a percentage, and
// deliberately not converted into one. The LHT65N runs a CR17450 Li-MnO2 cell,
// whose discharge curve is nearly flat: it sits close to its nominal voltage for
// most of its life and then falls away quickly near the end. A linear
// volts-to-percent mapping would therefore read ~100% for a year or more and
// then collapse within weeks — a number precise enough to be trusted and wrong
// enough to plan swap visits around.
//
// Three coarse tiers are honest about what the voltage can actually tell us.
// Thresholds are from Dragino's guidance (~2.6 V is their replace point); revisit
// them once we have months of real discharge curves from our own fleet.

export const BATTERY_GOOD_V = 3.0;
export const BATTERY_LOW_V = 2.7;

export type BatteryTier = "good" | "low" | "critical";

export function batteryTier(volts: number | null | undefined): BatteryTier | null {
  if (volts === null || volts === undefined || !Number.isFinite(volts)) return null;
  if (volts >= BATTERY_GOOD_V) return "good";
  if (volts >= BATTERY_LOW_V) return "low";
  return "critical";
}
