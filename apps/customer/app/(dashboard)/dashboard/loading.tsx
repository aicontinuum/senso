import { Skeleton } from "@/components/ui/skeleton";

// Mirrors dashboard/page.tsx: title + action, the three-up summary bar, then the
// responsive sensor-card grid.
function SensorCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mb-1 flex justify-center">
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="mb-4 flex justify-center">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-2 border-t pt-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="mb-6 grid grid-cols-3 divide-x rounded-lg border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Three cards is a guess at the fleet size — the grid is responsive, so
          settling to a different count reflows without disturbing anything above. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <SensorCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
