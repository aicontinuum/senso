import Link from "next/link";
import type { Sensor, AlertConfig } from "@senso/types";
import { cn } from "@/lib/utils";
import { SensorStatusBadge } from "@/components/SensorStatusBadge";
import { sensorState } from "@/lib/alert-state";
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
  timezone: string;
}

export function SensorCard({
  sensor,
  alertConfig,
  hasActiveAlert,
  timezone,
}: SensorCardProps) {
  // Undefined rather than null means the caller did not load the column at all,
  // which must not silently read as "not in service" and blank a working card.
  const inService = sensor.commissionedAt !== null;
  const isOffline = sensor.status === "offline";
  const temp = sensor.lastReading?.temperature;
  // A reading from a sensor that is not installed yet is a real measurement of
  // the wrong place, so it is neither in range nor out of it.
  const outOfRange =
    inService &&
    !isOffline &&
    temp !== undefined &&
    alertConfig !== undefined &&
    isOutOfRange(temp, alertConfig.minTemp, alertConfig.maxTemp);

  const state = sensorState({ inService, isOffline, outOfRange, hasOpenAlert: hasActiveAlert });

  return (
    <Link
      href={`/sensors/${sensor.id}`}
      className={cn(
        "block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40",
        (isOffline || !inService) && "opacity-70",
        state === "breaching" && "border-alert-border",
        state === "alert-open" && "border-warn-border",
      )}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight">{sensor.name}</span>
        <SensorStatusBadge state={state} className="shrink-0" />
      </div>

      {/* Temperature */}
      <div className="mb-1 text-center">
        <span
          className={cn(
            "text-4xl font-bold tabular-nums",
            (isOffline || !inService) && "text-muted-foreground",
            outOfRange && "text-alert-text",
          )}
        >
          {temp !== undefined ? formatTemp(temp) : "—"}
        </span>
      </div>

      {/* Range status label */}
      <div className="mb-4 text-center">
        {!inService ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Awaiting installation
          </span>
        ) : isOffline ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Offline
          </span>
        ) : outOfRange ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-alert-text">
            Out of range
          </span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-ok-text">
            In range
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
        {alertConfig && inService && (
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
            <span>{formatReadingTime(sensor.lastReading.recordedAt, timezone)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
