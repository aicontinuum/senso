import { Card, CardHeader, Skeleton } from "@senso/ui";

// Mirrors a customer's billing page: back link, title and buttons, the
// four headline figures, then the plan, invoices and history cards.
function ListCardSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-hairline">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-5 w-16 rounded-chip" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-3 h-6 w-24" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
      <Card className="grid grid-cols-2 gap-y-4 px-4 py-4 sm:grid-cols-4 sm:px-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </Card>
      <ListCardSkeleton rows={1} />
      <ListCardSkeleton rows={3} />
      <ListCardSkeleton rows={3} />
    </div>
  );
}
