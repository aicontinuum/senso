import Link from "next/link";
import type { Sensor, AlertConfig } from "@senso/types";
import { Card } from "@senso/ui";
import { READING_STALE_WARN_MS, formatAgo } from "@senso/status";
import { cn } from "@/lib/utils";
import { SensorStatusBadge } from "@/components/SensorStatusBadge";
import { RangeTrack } from "@/components/dashboard/RangeTrack";
import { sensorState } from "@/lib/alert-state";
import { RANGE_NEAR_FRACTION } from "@/lib/constants";
import {
  rangeProximity,
  formatTemp,
  formatThreshold,
  formatReadingTime,
  type RangeProximity,
} from "@/lib/temperature";

interface SensorCardProps {
  sensor: Sensor;
  alertConfig: AlertConfig | undefined;
  hasActiveAlert: boolean;
  timezone: string;
  /** Server clock at render; the page refreshes itself, so this stays current. */
  now: number;
}

// Below the number, one line saying what it means. Tone follows proximity so
// "near limit" is the amber step between in range and out of range.
const RANGE_LABEL: Record<RangeProximity, { text: string; className: string }> = {
  ok: { text: "In range", className: "font-medium text-ok-text" },
  near: { text: "Near limit", className: "font-semibold text-warn-text" },
  out: { text: "Out of range", className: "font-semibold text-alert-text" },
};

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
  const proximity: RangeProximity | null = judged
    ? rangeProximity(temp, alertConfig.minTemp, alertConfig.maxTemp)
    : null;
  const outOfRange = proximity === "out";

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
        ) : proximity ? (
          <span className={RANGE_LABEL[proximity].className}>{RANGE_LABEL[proximity].text}</span>
        ) : (
          <span className="font-medium text-muted-foreground">No limit set</span>
        )}
      </div>

      {/* Where the reading sits between its limits, only when it is being
          judged against them. */}
      {judged && proximity && (
        <RangeTrack
          temp={temp}
          min={alertConfig.minTemp}
          max={alertConfig.maxTemp}
          proximity={proximity}
          nearFraction={RANGE_NEAR_FRACTION}
          className="mb-4"
        />
      )}

      {/* Footer */}
      <div className="space-y-1 border-t border-hairline pt-3 text-xs text-muted-foreground">
        {/* The track already carries the limits at its ends; the row repeats
            them only when there is no track, such as offline. */}
        {alertConfig && inService && !judged && (
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
