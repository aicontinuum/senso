import { TEMP_UNIT } from "./constants";
import { DEFAULT_TIMEZONE } from "./timezones";

export function isOutOfRange(temp: number, min: number, max: number): boolean {
  return temp < min || temp > max;
}

export function formatTemp(temp: number): string {
  return `${temp}${TEMP_UNIT}`;
}

export function formatThreshold(min: number, max: number): string {
  return `${min}${TEMP_UNIT} – ${max}${TEMP_UNIT}`;
}

export function formatReadingTime(
  isoString: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

// Longer form with the year, for report headers and alert pages.
export function formatDateTimeLong(
  input: string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = new Date(input);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
