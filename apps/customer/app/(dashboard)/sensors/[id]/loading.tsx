import { Skeleton } from "@/components/ui/skeleton";

// Mirrors SensorDetailClient: back link, title + status badge, then the current
// reading, chart and settings cards inside a max-w-lg column.
export default function Loading() {
  return (
    <div className="max-w-lg">
      <Skeleton className="mb-6 h-4 w-16" />

      <div className="mt-4 mb-6 flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <section className="mb-4 rounded-lg border bg-card p-5">
        <Skeleton className="mb-3 h-3 w-32" />
        <div className="flex justify-center">
          <Skeleton className="h-12 w-32" />
        </div>
      </section>

      <section className="mb-4 rounded-lg border bg-card p-5">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-40 w-full" />
      </section>

      <section className="mb-4 rounded-lg border bg-card p-5">
        <Skeleton className="mb-4 h-3 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    </div>
  );
}
