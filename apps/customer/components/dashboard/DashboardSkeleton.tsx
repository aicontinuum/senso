import { Card } from "@senso/ui";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors dashboard/page.tsx: title + action, the three-up summary bar, the
// quick-actions tile, then the responsive sensor-card grid. Shown while the
// page loads, and as the stand-in behind a lock screen: it has the page's
// shape and none of its data.

export function SensorCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16 rounded-chip" />
      </div>
      <div className="mb-1 flex justify-center">
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="mb-4 flex justify-center">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-2 border-t border-hairline pt-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </Card>
  );
}

export const SENSOR_GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]";

// Quick actions are widgets, not tiles: square, on a fixed column well
// under a sensor tile's width, never stretched to fill the row, so one
// action stays small and more line up beside it.
export const QUICK_ACTIONS_GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,12.5rem)]";
export const QUICK_ACTION_TILE = "flex aspect-square flex-col justify-between p-3.5";

export function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-28" />
      </div>

      <Card className="mb-6 grid grid-cols-3 divide-x divide-hairline overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </Card>

      <Skeleton className="mb-3 h-6 w-28" />
      <div className={`${QUICK_ACTIONS_GRID} mb-8`}>
        <Card className={QUICK_ACTION_TILE}>
          <div className="flex items-center justify-between">
            <Skeleton className="size-8 rounded-control" />
            <Skeleton className="size-8 rounded-button" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-full lg:h-8" />
          <Skeleton className="h-8 w-full" />
        </Card>
      </div>

      <Skeleton className="mb-3 h-6 w-20" />

      {/* Three cards is a guess at the fleet size — the grid is responsive, so
          settling to a different count reflows without disturbing anything above. */}
      <div className={SENSOR_GRID}>
        {[0, 1, 2].map((i) => (
          <SensorCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
