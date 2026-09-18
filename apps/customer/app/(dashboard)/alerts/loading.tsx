import { Card, Skeleton } from "@senso/ui";

// Mirrors the alerts list: title, then a card of rows with a badge near the end.
export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-24" />
      <Card className="overflow-hidden">
        <div className="border-b border-hairline px-6 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="divide-y divide-hairline">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-5 w-20 rounded-chip" />
              <Skeleton className="size-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
