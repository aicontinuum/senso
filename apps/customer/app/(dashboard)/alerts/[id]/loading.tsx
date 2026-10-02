import { Card } from "@senso/ui";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the alert detail page: back link, the sensor's name and the
// alert's status, the reading card, then the comment card.
export default function Loading() {
  return (
    <div className="max-w-lg">
      <Skeleton className="h-8 w-20" />

      <div className="mb-6 mt-4 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-20 rounded-chip" />
      </div>

      <Card className="mb-4 p-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="mt-3 h-3 w-48" />
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-4 w-full max-w-sm" />
      </Card>
    </div>
  );
}
