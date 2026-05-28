import { TEMP_UNIT } from "./constants";

export function isOutOfRange(temp: number, min: number, max: number): boolean {
  return temp < min || temp > max;
}

export function formatTemp(temp: number): string {
  return `${temp}${TEMP_UNIT}`;
}

export function formatThreshold(min: number, max: number): string {
  return `${min}${TEMP_UNIT} – ${max}${TEMP_UNIT}`;
}

export function formatReadingTime(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(date);
}
