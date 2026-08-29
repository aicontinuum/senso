import { formatThreshold } from "./temperature";

// Resolving which temperature limits applied to a reading *at the time it was
// recorded*, rather than which apply now.
//
// Thresholds are effective-dated (see supabase/migrations/20260829_threshold_history.sql).
// A reading is judged against the version whose window covers its recorded_at,
// so a limit changed today cannot reach backwards and reclassify last week's
// readings — in either direction.

export type ThresholdType = "min" | "max";

export interface ThresholdVersion {
  type: ThresholdType;
  threshold: number;
  /** ISO instant, or the literal "-infinity" for backfilled versions. */
  effectiveFrom: string;
  /** ISO instant, or null while the version is still in force. */
  effectiveTo: string | null;
}

export interface Range {
  min: number | null;
  max: number | null;
}

export const NO_RANGE_LABEL = "—";

// Postgres serialises its unbounded timestamps as the strings "-infinity" and
// "infinity", which `new Date()` reads as Invalid Date — every comparison
// against one is then false and no version ever matches. They have to be mapped
// onto real infinities before any arithmetic.
function instantMs(value: string | null, whenNull: number): number {
  if (value === null) return whenNull;
  if (value === "-infinity") return Number.NEGATIVE_INFINITY;
  if (value === "infinity") return Number.POSITIVE_INFINITY;
  return new Date(value).getTime();
}

function covers(version: ThresholdVersion, atMs: number): boolean {
  const from = instantMs(version.effectiveFrom, Number.NEGATIVE_INFINITY);
  const to = instantMs(version.effectiveTo, Number.POSITIVE_INFINITY);
  // Half-open: the instant a version is replaced belongs to its successor, so
  // contiguous windows never both match.
  return atMs >= from && atMs < to;
}

/**
 * The limits in force at `atIso`. Either bound is null when no version of that
 * type covered the instant — a sensor that was recording before its alert
 * config existed has no limit to be judged against, and inventing one would put
 * a fabricated threshold into a compliance record.
 */
export function rangeAt(versions: ThresholdVersion[], atIso: string): Range {
  const atMs = new Date(atIso).getTime();
  const pick = (type: ThresholdType) =>
    versions.find((v) => v.type === type && covers(v, atMs))?.threshold ?? null;
  return { min: pick("min"), max: pick("max") };
}

export function hasRange(range: Range): boolean {
  return range.min !== null && range.max !== null;
}

/** True only when both bounds are known and the reading falls outside them. */
export function isOutOfRangeAt(temperature: number, range: Range): boolean {
  if (!hasRange(range)) return false;
  return temperature < range.min! || temperature > range.max!;
}

export function formatRange(range: Range): string {
  if (!hasRange(range)) return NO_RANGE_LABEL;
  return formatThreshold(range.min!, range.max!);
}

/**
 * The distinct ranges that applied across a set of readings, in the order first
 * encountered. A report header can state a single threshold only when this
 * returns exactly one; otherwise the header would contradict the rows beneath
 * it.
 */
export function distinctRanges(
  versions: ThresholdVersion[],
  readings: { recordedAt: string }[],
): Range[] {
  const seen = new Map<string, Range>();
  for (const reading of readings) {
    const range = rangeAt(versions, reading.recordedAt);
    const key = `${range.min}|${range.max}`;
    if (!seen.has(key)) seen.set(key, range);
  }
  return [...seen.values()];
}

/** The `Threshold:` line for a report header, honest about mid-period changes. */
export function thresholdSummary(
  versions: ThresholdVersion[],
  readings: { recordedAt: string }[],
): string | null {
  const ranges = distinctRanges(versions, readings);
  if (ranges.length === 0) return null;
  if (ranges.length === 1) {
    return hasRange(ranges[0])
      ? `Threshold: ${formatRange(ranges[0])}`
      : "Threshold: none set";
  }
  return "Threshold: changed during this period — see Range column";
}
