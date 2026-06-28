// Curated list of timezones offered to customers. Used by the settings dropdown,
// the report timezone stamp, and the /api/account validation allowlist.

export const TIMEZONES = [
  { value: "Asia/Qatar", label: "Qatar (UTC+3)" },
  { value: "Asia/Dubai", label: "United Arab Emirates (UTC+4)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia (UTC+3)" },
  { value: "Asia/Kuwait", label: "Kuwait (UTC+3)" },
  { value: "Asia/Bahrain", label: "Bahrain (UTC+3)" },
  { value: "Asia/Muscat", label: "Oman (UTC+4)" },
  { value: "UTC", label: "UTC" },
] as const;

export type TimezoneValue = (typeof TIMEZONES)[number]["value"];

export const DEFAULT_TIMEZONE: TimezoneValue = "Asia/Qatar";

export function isValidTimezone(value: string): value is TimezoneValue {
  return TIMEZONES.some((tz) => tz.value === value);
}

export function timezoneLabel(value: string): string {
  return TIMEZONES.find((tz) => tz.value === value)?.label ?? value;
}
