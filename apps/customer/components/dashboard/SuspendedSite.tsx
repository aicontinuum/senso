import { Badge } from "@senso/ui";
import { SENSOR_GRID, SensorCardSkeleton } from "@/components/dashboard/DashboardSkeleton";

// A member account that is suspended, as the owner login sees it: its name,
// a badge, and blurred tiles with nothing behind them. The account's data
// was never loaded, so there is nothing under the blur to uncover.
export function SuspendedSite({ name }: { name: string }) {
  return (
    <section aria-label={`${name}, suspended`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight">{name}</h3>
        <Badge variant="alert" dot>Account suspended</Badge>
      </div>
      <div inert aria-hidden className={`${SENSOR_GRID} pointer-events-none select-none blur-sm`}>
        {[0, 1, 2].map((i) => <SensorCardSkeleton key={i} />)}
      </div>
    </section>
  );
}
