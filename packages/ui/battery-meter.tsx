import { batteryTier, type BatteryTier } from "@senso/status";
import { cn } from "./cn";

// Three segments, one lit per tier, so the level reads at a glance from the
// count as well as the colour rather than from bar length alone. The tiers come
// from @senso/status, which explains why this is not a percentage.
//
// Renders nothing when there is no reading to judge: an empty meter would read
// as a flat battery, which is a different and alarming claim.

const SEGMENTS: Record<BatteryTier, { color: string; lit: number }> = {
  good: { color: "bg-ok-500", lit: 3 },
  low: { color: "bg-warn-500", lit: 2 },
  critical: { color: "bg-alert-500", lit: 1 },
};

export function BatteryMeter({
  volts,
  className,
}: {
  /** Latest reported battery voltage, or null when the sensor has never reported one. */
  volts: number | null | undefined;
  className?: string;
}) {
  const tier = batteryTier(volts);
  if (!tier || volts === null || volts === undefined) return null;
  const { color, lit } = SEGMENTS[tier];

  return (
    <div
      role="img"
      aria-label={`Battery ${tier}, ${volts.toFixed(2)} volts`}
      title={`${volts.toFixed(2)} V`}
      className={cn("flex w-16 gap-1", className)}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn("h-2 flex-1 rounded-full", i < lit ? color : "bg-chart-track")}
        />
      ))}
    </div>
  );
}
