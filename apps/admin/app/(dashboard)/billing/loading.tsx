import { Card, Skeleton } from "@senso/ui";

// Mirrors the billing list: title, the summary strip (a hero over three
// tiles), the needs-action card, then the filter chips and the customers
// table.
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />

      <Card className="overflow-hidden">
        <div className="space-y-2 px-5 py-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-2 w-full max-w-md rounded-full" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 px-5 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-hairline overflow-hidden">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-4 w-4" />
          </div>
        ))}
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-chip" />)}
        </div>
        <Card className="divide-y divide-hairline overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-6">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
