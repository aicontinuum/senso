import { Card, CardHeader, Skeleton } from "@senso/ui";

// Mirrors the settings column: six headed cards of varying body height.
const ROW_WIDTHS = ["w-2/3", "w-1/2", "w-2/5", "w-1/3"];
function SettingsCardSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <div className="space-y-3 p-5">
        {ROW_WIDTHS.slice(0, rows).map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
      </div>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="max-w-lg space-y-6">
      <Skeleton className="h-8 w-28" />
      <SettingsCardSkeleton rows={4} />
      <SettingsCardSkeleton rows={1} />
      <SettingsCardSkeleton rows={2} />
      <SettingsCardSkeleton rows={1} />
      <SettingsCardSkeleton rows={2} />
      <Card className="overflow-hidden">
        <CardHeader className="border-b-0">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
      </Card>
    </div>
  );
}
