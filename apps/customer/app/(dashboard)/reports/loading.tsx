import { Skeleton } from "@/components/ui/skeleton";

// Mirrors ReportClient's filter bar: time-range buttons, the sensor picker, and
// the generate action. The report body only exists after generating, so there is
// nothing below to stand in for.
export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-32" />

      <div className="flex flex-col gap-4">
        <div>
          <Skeleton className="mb-2 h-4 w-24" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-28" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-16" />
          <Skeleton className="mb-2 h-4 w-24" />
          <div className="w-fit rounded-md border border-border p-2">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-32" />
              ))}
            </div>
          </div>
        </div>

        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
