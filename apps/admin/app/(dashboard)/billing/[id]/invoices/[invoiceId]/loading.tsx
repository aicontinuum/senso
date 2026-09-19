import { Card, CardHeader, Skeleton } from '@senso/ui';

// Mirrors the invoice page: back link, number and badge, then the figures,
// the lines and the history.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-3 h-6 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-5 w-16 rounded-chip" />
          <Skeleton className="ml-auto h-8 w-36" />
        </div>
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <Card className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
      {[2, 3].map(rows => (
        <Card key={rows} className="overflow-hidden">
          <CardHeader className="border-b border-hairline"><Skeleton className="h-5 w-24" /></CardHeader>
          <div className="divide-y divide-hairline">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-6 px-5 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
