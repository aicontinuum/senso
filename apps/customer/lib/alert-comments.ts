import type { Range, ThresholdType } from "./thresholds";
import { hasRange } from "./thresholds";

// Matching a reading in a report back to the note a supervisor wrote about the
// incident it belongs to.
//
// A report row showing 18 °C is a failing fridge. The same row carrying
// "cleaning the fridge, doors open" is a well-run kitchen. The note lives on the
// alert; this works out which alert a given reading belongs to.
//
// `alert_logs` records when an alert opened but not when it closed, so an
// episode's end is not stored anywhere. It does not need to be: an episode is a
// contiguous run of breaching readings following a trigger, so a breaching
// reading belongs to the most recent alert of the same bound at or before it.
// Two consecutive episodes resolve correctly because the second one's trigger is
// nearer; readings back in range match nothing, which is right — there is no
// incident to explain.

export interface AlertNote {
  /** Which bound the alert was raised against. */
  type: ThresholdType;
  triggeredAt: string;
  /** Null when the alert exists but nobody has written a note on it. */
  comment: string | null;
}

/**
 * Which limit this reading broke, or null if it broke none.
 *
 * Null is also the answer when the range is unknown — a reading with no limits
 * in force at the time cannot have breached them, and guessing would put a
 * verdict into a compliance record that nothing supports.
 */
export function breachedBound(temperature: number, range: Range): ThresholdType | null {
  if (!hasRange(range)) return null;
  if (temperature < range.min!) return "min";
  if (temperature > range.max!) return "max";
  return null;
}

/**
 * The note explaining this reading, or null when there is nothing to explain.
 *
 * @param notes Every alert for this sensor, any order. Alerts that opened before
 *              the report period are needed too — an episode spanning the start
 *              is explained by a trigger that falls outside it.
 */
export function commentForReading(
  notes: AlertNote[],
  temperature: number,
  range: Range,
  recordedAt: string,
): string | null {
  const bound = breachedBound(temperature, range);
  if (bound === null) return null;

  const at = new Date(recordedAt).getTime();
  if (!Number.isFinite(at)) return null;

  let best: AlertNote | null = null;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const note of notes) {
    if (note.type !== bound) continue;
    const triggered = new Date(note.triggeredAt).getTime();
    if (!Number.isFinite(triggered) || triggered > at) continue;
    if (triggered > bestAt) {
      bestAt = triggered;
      best = note;
    }
  }

  return best?.comment ?? null;
}
