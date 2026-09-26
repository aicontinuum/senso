// The temperature limits a sensor may be given, checked the same way on
// both sites: the customer sets them on the sensor page, the admin on the
// sensor settings page. The bounds also cap what ingest will store, so a
// limit outside them could never be crossed or never be met.

export const THRESHOLD_MIN_C = -80;
export const THRESHOLD_MAX_C = 100;

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type ThresholdsResult = { ok: true; min: number; max: number } | { ok: false; error: string };

/** Both limits from a request body: real numbers, within the sensor's
 *  range, min below max. Returns the numbers to store, or the first problem. */
export function validateThresholds(minTemp: unknown, maxTemp: unknown): ThresholdsResult {
  const min = asFiniteNumber(minTemp);
  const max = asFiniteNumber(maxTemp);
  if (min === null || max === null) return { ok: false, error: 'Both limits must be numbers.' };
  if (min < THRESHOLD_MIN_C || max > THRESHOLD_MAX_C) {
    return { ok: false, error: `Limits must be between ${THRESHOLD_MIN_C} and ${THRESHOLD_MAX_C} °C.` };
  }
  if (min >= max) return { ok: false, error: 'Min must be less than max.' };
  return { ok: true, min, max };
}
