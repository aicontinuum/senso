import { TEMP_UNIT, TEMP_DECIMALS, RANGE_NEAR_FRACTION } from "./constants";
import { DEFAULT_TIMEZONE } from "./timezones";

export function isOutOfRange(temp: number, min: number, max: number): boolean {
  return temp < min || temp > max;
}

export type RangeProximity = "ok" | "near" | "out";

// Where a reading sits inside its limits. "Near" is the band inside either
// edge, a fixed fraction of the span, so a fridge drifting toward its limit
// shows before it crosses it. The alert logic does not use this: an alert is
// still raised only on a breach.
export function rangeProximity(temp: number, min: number, max: number): RangeProximity {
  if (isOutOfRange(temp, min, max)) return "out";
  const margin = (max - min) * RANGE_NEAR_FRACTION;
  return temp < min + margin || temp > max - margin ? "near" : "ok";
}

// 0 at the lower limit, 1 at the upper, clamped so an out-of-range reading
// pins to the nearest edge of the track rather than leaving it.
export function rangePosition(temp: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (temp - min) / (max - min)));
}

export function formatTemp(temp: number): string {
  return `${temp.toFixed(TEMP_DECIMALS)}${TEMP_UNIT}`;
}

export function formatThreshold(min: number, max: number): string {
  return `${min.toFixed(TEMP_DECIMALS)}${TEMP_UNIT} – ${max.toFixed(TEMP_DECIMALS)}${TEMP_UNIT}`;
}

export function formatReadingTime(
  isoString: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const zone = timeZone || DEFAULT_TIMEZONE;
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).format(date);
}

// Longer form with the year, for report headers and alert pages.
export function formatDateTimeLong(
  input: string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const zone = timeZone || DEFAULT_TIMEZONE;
  const date = new Date(input);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  }).format(date);
}
