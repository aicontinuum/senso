import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the admin dashboard: three-up stat bar, then the customers table.
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />

      <div className="grid grid-cols-3 divide-x rounded-lg border bg-card shadow-sm">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 px-6 py-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
