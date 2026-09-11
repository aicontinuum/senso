import { cn } from "@/lib/utils";
import { formatTemp, rangePosition, type RangeProximity } from "@/lib/temperature";

// Where the reading sits between its two limits, drawn as a marker on a track.
// The card's number says what the temperature is; this says how much room it
// has left. Marker colour follows the proximity tone, and an out-of-range
// reading pins to the edge it crossed.
//
// The near band at each end is drawn as a faint tint so the marker's amber has
// a visible reason. Purely visual: alerts are still raised only on a breach.

const MARKER_TONE: Record<RangeProximity, string> = {
  ok: "bg-ok-500",
  near: "bg-warn-500",
  out: "bg-alert-500",
};

interface RangeTrackProps {
  temp: number;
  min: number;
  max: number;
  proximity: RangeProximity;
  /** Width of the near band at each end, as a fraction of the span. */
  nearFraction: number;
  className?: string;
}

export function RangeTrack({ temp, min, max, proximity, nearFraction, className }: RangeTrackProps) {
  const left = `${rangePosition(temp, min, max) * 100}%`;
  const band = `${nearFraction * 100}%`;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="img"
        aria-label={`${formatTemp(temp)}, limits ${formatTemp(min)} to ${formatTemp(max)}`}
        className="relative h-1.5 rounded-full bg-chart-track"
      >
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-warn-soft" style={{ width: band }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-warn-soft" style={{ width: band }} />
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
            MARKER_TONE[proximity],
          )}
          style={{ left }}
        />
      </div>
      <div className="flex justify-between font-mono text-2xs text-text-faint">
        <span>{formatTemp(min)}</span>
        <span>{formatTemp(max)}</span>
      </div>
    </div>
  );
}
