import { formatDateTimeLong } from "./temperature";

// Which readings belong in a customer's compliance record, and what a report has
// to say when some do not.
//
// A sensor is registered during office prep and powered on for the bench test,
// so it reports for hours or days before it is anywhere near the customer's
// fridge. Those readings are real measurements of the wrong place. Attributing
// them to the customer puts a documented excursion into a compliance record for
// an event that never happened — and the customer cannot disprove it.
//
// `sensors.commissioned_at` is the boundary. See
// supabase/migrations/20260902_sensor_commissioning.sql.

/** Just enough of a reading for the cut; the caller's own shape flows through. */
export interface DatedReading {
  recordedAt: string;
}

/**
 * Drops readings taken before the sensor entered service.
 *
 * A sensor that was never commissioned yields nothing: it has no service history
 * at all, only bench readings, so there is no such thing as a report for it.
 */
export function inServiceReadings<T extends DatedReading>(
  commissionedAt: string | null,
  readings: T[],
): T[] {
  if (!commissionedAt) return [];
  const from = new Date(commissionedAt).getTime();
  // An unparseable timestamp must not fall back to "include everything" — that
  // would put pre-installation readings back into the record on a bad value.
  if (!Number.isFinite(from)) return [];
  return readings.filter((r) => {
    const at = new Date(r.recordedAt).getTime();
    return Number.isFinite(at) && at >= from;
  });
}

/**
 * The note explaining why a report starts later than the period asked for.
 *
 * Null when there is nothing to explain: the sensor entered service at or before
 * the period began, so no readings were excluded. Saying it anyway on every
 * report would train people to ignore it, which is the opposite of the point.
 *
 * This is the mirror of the retirement note at the other end of a sensor's life.
 * A silently short report is exactly the kind of gap an inspector is entitled to
 * ask about, and the answer should already be printed on the page.
 */
export function commissionedNote(
  commissionedAt: string | null,
  periodStartMs: number,
  timezone: string,
): string | null {
  if (!commissionedAt) return null;
  const at = new Date(commissionedAt).getTime();
  if (!Number.isFinite(at) || at <= periodStartMs) return null;
  return `Sensor put into service ${formatDateTimeLong(commissionedAt, timezone)} — readings before this were taken before installation and are excluded.`;
}
