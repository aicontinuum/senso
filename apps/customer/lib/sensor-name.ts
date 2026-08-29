// Validation for a customer-supplied sensor name.
//
// Shared so the field can give immediate feedback while the server stays the
// authority — the client copy is a convenience, never the check that counts.

export const SENSOR_NAME_MAX_LENGTH = 60;

// An allowlist rather than a blocklist: letters and digits in any script (Arabic
// included — these are Qatar sites), spaces, and the punctuation that shows up in
// real equipment names such as "Walk-in cooler #2" or "Prep line (left)".
//
// Typographic quotes are included because iOS and macOS autocorrect produce them:
// someone typing "Chef's fridge" on a phone gets a curly apostrophe, and being
// rejected for it would be baffling.
const ALLOWED = /^[\p{L}\p{N} _\-.,/()#&'"‘’“”]+$/u;

export type SensorNameError =
  | "empty"
  | "too-long"
  | "invalid-characters";

export const SENSOR_NAME_MESSAGES: Record<SensorNameError, string> = {
  empty: "Sensor name is required.",
  "too-long": `Sensor name must be ${SENSOR_NAME_MAX_LENGTH} characters or fewer.`,
  "invalid-characters":
    "Sensor name can use letters, numbers, spaces and basic punctuation.",
};

/**
 * Normalises a name for storage: trims the ends and collapses runs of
 * whitespace, so " Walk-in   cooler " and "Walk-in cooler" cannot both exist and
 * look identical in a report.
 *
 * `\s` covers tabs and newlines too, so a pasted multi-line string is flattened
 * to one line rather than rejected. Control characters that are not whitespace
 * survive this step and are then caught by the allowlist.
 */
export function normaliseSensorName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Returns null when the name is acceptable. */
export function validateSensorName(raw: unknown): SensorNameError | null {
  if (typeof raw !== "string") return "empty";
  const name = normaliseSensorName(raw);
  if (name.length === 0) return "empty";
  if (name.length > SENSOR_NAME_MAX_LENGTH) return "too-long";
  if (!ALLOWED.test(name)) return "invalid-characters";
  return null;
}
