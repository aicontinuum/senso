import { Card, CardHeader, Skeleton } from "@senso/ui";

// Mirrors the settings page: title, then four read-mode cards of label
// and value pairs in two columns.
function SettingsCardSkeleton({ pairs }: { pairs: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between border-b border-hairline">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-16" />
      </CardHeader>
      <div className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
        {Array.from({ length: pairs }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />
      <SettingsCardSkeleton pairs={7} />
      <SettingsCardSkeleton pairs={4} />
      <SettingsCardSkeleton pairs={5} />
      <SettingsCardSkeleton pairs={4} />
    </div>
  );
}
