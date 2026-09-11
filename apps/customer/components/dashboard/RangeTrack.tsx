import { cn } from "@/lib/utils";
import { formatTemp, rangeTrackScale, scalePosition } from "@/lib/temperature";

// Where the reading sits relative to its limits. The track is wider than the
// allowed range: the safe band is drawn green in the middle, with a margin on
// each side, so a marker outside the band is visibly outside it rather than
// pinned to an edge. The marker is green inside the band and red once it has
// crossed a limit, and nothing changes colour before that.
//
// The limits are labelled under the band's edges, where they apply, rather
// than at the ends of the track.

interface RangeTrackProps {
  temp: number;
  min: number;
  max: number;
  outOfRange: boolean;
  className?: string;
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function RangeTrack({ temp, min, max, outOfRange, className }: RangeTrackProps) {
  const { lo, hi } = rangeTrackScale(min, max);
  const bandStart = scalePosition(min, lo, hi);
  const bandEnd = scalePosition(max, lo, hi);
  const marker = scalePosition(temp, lo, hi);

  return (
    <div
      role="img"
      aria-label={`${formatTemp(temp)}, limits ${formatTemp(min)} to ${formatTemp(max)}`}
      className={cn("relative pb-4 pt-1", className)}
    >
      <div className="relative h-2 rounded-full bg-chart-track">
        <div
          className="absolute inset-y-0 rounded-full bg-ok-500/45"
          style={{ left: pct(bandStart), width: pct(bandEnd - bandStart) }}
        />
        <div
          className={cn(
            "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2 ring-card",
            outOfRange ? "bg-alert-500" : "bg-ok-500",
          )}
          style={{ left: pct(marker) }}
        />
      </div>
      <span
        className="absolute bottom-0 -translate-x-1/2 font-mono text-2xs text-text-faint"
        style={{ left: pct(bandStart) }}
      >
        {formatTemp(min)}
      </span>
      <span
        className="absolute bottom-0 -translate-x-1/2 font-mono text-2xs text-text-faint"
        style={{ left: pct(bandEnd) }}
      >
        {formatTemp(max)}
      </span>
    </div>
  );
}
