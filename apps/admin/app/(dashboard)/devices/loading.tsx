import { Card, CardHeader, Skeleton } from "@senso/ui";

// Mirrors the devices page: title and the two register buttons, then the
// Gateways card and the Sensors card.
function DeviceCardSkeleton({ rows, hint }: { rows: number; hint?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline">
        <Skeleton className="h-5 w-24" />
        {hint && <Skeleton className="h-4 w-full max-w-lg" />}
      </CardHeader>
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-4 lg:px-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-40 lg:block" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="size-9 rounded-button" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <DeviceCardSkeleton rows={2} />
      <DeviceCardSkeleton rows={4} hint />
    </div>
  );
}
