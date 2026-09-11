import { cn } from "@/lib/utils";
import { formatTemp, rangePosition } from "@/lib/temperature";

// Where the reading sits between its two limits, drawn as a marker on a track.
// The card's number says what the temperature is; this says how much room it
// has left. The marker is green anywhere inside the limits and red once it
// has crossed one, pinned to the edge it crossed: the track shows closeness by
// position alone and never changes colour before a breach.

interface RangeTrackProps {
  temp: number;
  min: number;
  max: number;
  outOfRange: boolean;
  className?: string;
}

export function RangeTrack({ temp, min, max, outOfRange, className }: RangeTrackProps) {
  const left = `${rangePosition(temp, min, max) * 100}%`;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="img"
        aria-label={`${formatTemp(temp)}, limits ${formatTemp(min)} to ${formatTemp(max)}`}
        className="relative h-1.5 rounded-full bg-chart-track"
      >
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
            outOfRange ? "bg-alert-500" : "bg-ok-500",
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
