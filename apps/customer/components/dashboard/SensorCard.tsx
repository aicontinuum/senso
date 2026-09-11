import Link from "next/link";
import type { Sensor, AlertConfig } from "@senso/types";
import { Card } from "@senso/ui";
import { READING_STALE_WARN_MS, formatAgo } from "@senso/status";
import { cn } from "@/lib/utils";
import { SensorStatusBadge } from "@/components/SensorStatusBadge";
import { RangeTrack } from "@/components/dashboard/RangeTrack";
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
  /** Server clock at render; the page refreshes itself, so this stays current. */
  now: number;
}

export function SensorCard({
  sensor,
  alertConfig,
  hasActiveAlert,
  timezone,
  now,
}: SensorCardProps) {
  // Undefined rather than null means the caller did not load the column at all,
  // which must not silently read as "not in service" and blank a working card.
  const inService = sensor.commissionedAt !== null;
  const isOffline = sensor.status === "offline";
  const temp = sensor.lastReading?.temperature;
  // A reading from a sensor that is not installed yet is a real measurement of
  // the wrong place, so it is neither in range nor out of it.
  const judged = inService && !isOffline && temp !== undefined && alertConfig !== undefined;
  const outOfRange = judged && isOutOfRange(temp, alertConfig.minTemp, alertConfig.maxTemp);

  const state = sensorState({ inService, isOffline, outOfRange, hasOpenAlert: hasActiveAlert });

  // A reading older than a missed interval is flagged before the sensor is
  // formally offline, so a quiet sensor is noticed a cycle early.
  const readingAge = sensor.lastReading ? now - new Date(sensor.lastReading.recordedAt).getTime() : null;
  const readingStale = !isOffline && readingAge !== null && readingAge > READING_STALE_WARN_MS;

  return (
    // The card is the link: the whole tile is the target, and the design
    // system's card chrome comes from the primitive rather than being redrawn
    // here. A breach or open alert tints the hairline in its status tone.
    <Card
      asChild
      className={cn(
        "block p-5 transition-[background-color,box-shadow] hover:bg-sunken hover:shadow-md",
        (isOffline || !inService) && "opacity-70",
        state === "breaching" && "border-alert-border",
        state === "alert-open" && "border-warn-border",
      )}
    >
    <Link href={`/sensors/${sensor.id}`}>
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight">{sensor.name}</span>
        <SensorStatusBadge state={state} className="shrink-0" />
      </div>

      {/* Temperature */}
      <div className="mb-1 text-center">
        <span
          className={cn(
            "font-display text-4xl font-bold tabular-nums",
            (isOffline || !inService) && "text-muted-foreground",
            outOfRange && "text-alert-text",
          )}
        >
          {temp !== undefined ? formatTemp(temp) : "—"}
        </span>
      </div>

      {/* Range status label */}
      <div className="mb-4 text-center text-xs uppercase tracking-wide">
        {!inService ? (
          <span className="font-medium text-muted-foreground">Awaiting installation</span>
        ) : isOffline ? (
          <span className="font-medium text-muted-foreground">Offline</span>
        ) : judged ? (
          outOfRange
            ? <span className="font-semibold text-alert-text">Out of range</span>
            : <span className="font-medium text-ok-text">In range</span>
        ) : (
          <span className="font-medium text-muted-foreground">No limit set</span>
        )}
      </div>

      {/* Where the reading sits between its limits, only when it is being
          judged against them. */}
      {judged && (
        <RangeTrack
          temp={temp}
          min={alertConfig.minTemp}
          max={alertConfig.maxTemp}
          outOfRange={outOfRange}
          className="mb-4"
        />
      )}

      {/* Footer */}
      <div className="space-y-1 border-t border-hairline pt-3 text-xs text-muted-foreground">
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
            {/* Relative, because "how long ago" is the question; the exact
                time is a hover away. Amber once a reading has been missed. */}
            <span
              title={formatReadingTime(sensor.lastReading.recordedAt, timezone)}
              className={cn(readingStale && "font-medium text-warn-text")}
            >
              {formatAgo(sensor.lastReading.recordedAt, now)}
            </span>
          </div>
        )}
      </div>
    </Link>
    </Card>
  );
}
