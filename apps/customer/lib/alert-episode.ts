import { isOutOfRange } from "./temperature";

// An alert is an episode, not an instant: it opens on the first reading that
// breaches a limit and closes on the first one that comes back inside it. The
// detail chart used to draw a fixed ±12 hours around the trigger, which showed
// mostly unrelated readings for a two-reading blip and cut off a breach that
// outlasted the window. This trims the series to the episode itself, plus the
// in-range reading either side so the drop out of range and the recovery back
// into it are both visible.

export interface EpisodeReading {
  temperature: number;
  recordedAt: string;
}

export interface AlertEpisode {
  /** The readings to plot: one in-range, the breaching run, one in-range. */
  readings: EpisodeReading[];
  /** How many of them are outside the range. */
  breachCount: number;
  /**
   * The breach ran past the readings on hand — either it is still open or it
   * outlasted the point cap. The chart shows its start, not the whole of it.
   */
  truncated: boolean;
}

const EMPTY: AlertEpisode = { readings: [], breachCount: 0, truncated: false };

/**
 * @param readings  Ascending by recordedAt, starting some way before the alert.
 * @param range     The limits in force when the alert fired — the same pair the
 *                  chart draws, so what trimmed the series matches what the eye
 *                  reads off it.
 * @param maxPoints Cap on plotted points; see ALERT_EPISODE_MAX_POINTS.
 */
export function alertEpisode(
  readings: EpisodeReading[],
  triggeredAt: string,
  range: { min: number; max: number },
  maxPoints: number,
): AlertEpisode {
  if (readings.length === 0 || maxPoints < 1) return EMPTY;

  const breaches = readings.map((r) => isOutOfRange(r.temperature, range.min, range.max));

  const triggeredMs = new Date(triggeredAt).getTime();
  let triggerIdx = 0;
  for (let i = 1; i < readings.length; i++) {
    const here = Math.abs(new Date(readings[i].recordedAt).getTime() - triggeredMs);
    const best = Math.abs(new Date(readings[triggerIdx].recordedAt).getTime() - triggeredMs);
    if (here < best) triggerIdx = i;
  }

  // Normally the trigger reading is itself a breach. It is not when the alert
  // was opened by something other than this reading — the offline sweep, or a
  // threshold edited after the fact — in which case there is no run to walk and
  // the reading either side is all the context there is.
  let first = triggerIdx;
  let last = triggerIdx;
  if (breaches[triggerIdx]) {
    while (first > 0 && breaches[first - 1]) first--;
    while (last < readings.length - 1 && breaches[last + 1]) last++;
  }

  // Still breaching at the last reading we have: the episode is unfinished.
  const ranOut = last === readings.length - 1 && breaches[last];

  const from = Math.max(0, first - 1);
  const to = Math.min(readings.length - 1, last + 1);
  const window = readings.slice(from, to + 1);

  const capped = window.length > maxPoints;
  const plotted = capped ? window.slice(0, maxPoints) : window;

  return {
    readings: plotted,
    breachCount: plotted.filter((_, i) => breaches[from + i]).length,
    truncated: ranOut || capped,
  };
}
