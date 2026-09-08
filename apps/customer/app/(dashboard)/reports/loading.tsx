import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Mirrors ReportClient's settings card: time-range segments, the sensor list,
// the format toggle and the generate action. The report body only exists after
// generating, so there is nothing below to stand in for.
export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-32" />

      <Card className="max-w-xl">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>

          <div>
            <Skeleton className="mb-2 h-4 w-16" />
            <div className="space-y-px overflow-hidden rounded-inner">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-none" />
              ))}
            </div>
          </div>

          <div>
            <Skeleton className="mb-2 h-4 w-16" />
            <Skeleton className="h-10 w-40" />
          </div>

          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
