import { TEMP_UNIT, TEMP_DECIMALS, RANGE_TRACK_PADDING_FRACTION } from "./constants";
import { DEFAULT_TIMEZONE } from "./timezones";

export function isOutOfRange(temp: number, min: number, max: number): boolean {
  return temp < min || temp > max;
}

// The scale the dashboard track is drawn on: the limits plus a margin each
// side, so a reading past a limit has somewhere to be drawn.
export function rangeTrackScale(min: number, max: number): { lo: number; hi: number } {
  const span = Math.max(max - min, 0);
  const pad = span * RANGE_TRACK_PADDING_FRACTION;
  return { lo: min - pad, hi: max + pad };
}

// 0 at the low end of a scale, 1 at the high end, clamped so a reading far
// outside the scale pins to the nearest end rather than leaving the track.
export function scalePosition(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0.5;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
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
