import { TEMP_UNIT, TEMP_DECIMALS } from "./constants";
import { DEFAULT_TIMEZONE } from "./timezones";

export function isOutOfRange(temp: number, min: number, max: number): boolean {
  return temp < min || temp > max;
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
