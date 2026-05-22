import Link from "next/link";
import type { Sensor, AlertConfig } from "@senso/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  isOutOfRange,
  formatTemp,
  formatThreshold,
  formatReadingTime,
} from "@/lib/temperature";

interface SensorCardProps {
  sensor: Sensor;
  alertConfig: AlertConfig | undefined;
  hasActiveAlert: boolean;
}

export function SensorCard({
  sensor,
  alertConfig,
  hasActiveAlert,
}: SensorCardProps) {
  const isOffline = sensor.status === "offline";
  const temp = sensor.lastReading?.temperature;
  const outOfRange =
    !isOffline &&
    temp !== undefined &&
    alertConfig !== undefined &&
    isOutOfRange(temp, alertConfig.minTemp, alertConfig.maxTemp);

  return (
    <Link
      href={`/sensors/${sensor.id}`}
      className={cn(
        "block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40",
        isOffline && "opacity-70",
        outOfRange && "border-red-400",
      )}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight">{sensor.name}</span>
        <StatusBadge
          isOffline={isOffline}
          outOfRange={outOfRange}
          hasActiveAlert={hasActiveAlert}
        />
      </div>

      {/* Temperature */}
      <div className="mb-1 text-center">
        <span
          className={cn(
            "text-4xl font-bold tabular-nums",
            isOffline && "text-muted-foreground",
            outOfRange && "text-red-600",
          )}
        >
          {temp !== undefined ? formatTemp(temp) : "—"}
        </span>
      </div>

      {/* Range status label */}
      <div className="mb-4 text-center">
        {isOffline ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Offline
          </span>
        ) : outOfRange ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Out of range
          </span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-green-700">
            In range
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
        {alertConfig && (
          <div className="flex justify-between">
            <span>Threshold</span>
            <span className="font-medium text-foreground">
              {formatThreshold(alertConfig.minTemp, alertConfig.maxTemp)}
            </span>
          </div>
        )}
        {sensor.lastReading && (
          <div className="flex justify-between">
            <span>{isOffline ? "Last seen" : "Updated"}</span>
            <span>{formatReadingTime(sensor.lastReading.recordedAt)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusBadge({
  isOffline,
  outOfRange,
  hasActiveAlert,
}: {
  isOffline: boolean;
  outOfRange: boolean | undefined;
  hasActiveAlert: boolean;
}) {
  if (isOffline) {
    return (
      <Badge variant="secondary" className="shrink-0 gap-1.5">
        <span className="size-1.5 rounded-full bg-zinc-400" />
        Offline
      </Badge>
    );
  }
  if (outOfRange || hasActiveAlert) {
    return (
      <Badge
        variant="destructive"
        className="shrink-0 gap-1.5 bg-red-100 text-red-700 hover:bg-red-100"
      >
        <span className="size-1.5 rounded-full bg-red-500" />
        Alert
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0 gap-1.5 bg-green-50 text-green-700">
      <span className="size-1.5 rounded-full bg-green-500" />
      Online
    </Badge>
  );
}
