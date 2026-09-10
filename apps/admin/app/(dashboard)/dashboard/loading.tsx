import { Card, Skeleton } from "@senso/ui";

// Mirrors the admin dashboard: the collapsed watchdog header, the stat tiles,
// then the customers table.
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />

      {/* The watchdog card is collapsed to its header when healthy, which is
          the usual case, so the placeholder is the header alone. */}
      <Card className="flex items-center gap-2.5 px-6 py-3">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16" />
      </Card>

      <Card className="grid grid-cols-2 divide-hairline overflow-hidden sm:grid-cols-4 sm:divide-x">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 px-6 py-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </Card>

      <div>
        <Skeleton className="mb-3 h-6 w-28" />
        <Card className="overflow-hidden">
          <div className="border-b border-hairline px-6 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="divide-y divide-hairline">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <Skeleton className="h-5 w-16 rounded-chip" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
