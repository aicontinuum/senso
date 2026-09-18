import { Card, CardHeader, Skeleton } from "@senso/ui";

// Mirrors the customer detail page: back link, title, then the four cards.
function TableCardSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-hairline">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
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
        <Skeleton className="h-8 w-48" />
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b border-hairline">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-16" />
        </CardHeader>
        <div className="space-y-4 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40 sm:col-span-2" />
            </div>
          ))}
        </div>
      </Card>
      <TableCardSkeleton rows={1} />
      <TableCardSkeleton rows={2} />
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-hairline">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <div className="space-y-3 p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
      </Card>
    </div>
  );
}
