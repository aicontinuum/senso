import type { Sensor, AlertConfig } from "@senso/types";
import { SensorCard } from "@/components/dashboard/SensorCard";
import { SENSOR_GRID } from "@/components/dashboard/DashboardSkeleton";

// The sensor tiles, on the grid the skeleton and the quick actions share.
// The design system fixes the tile floor at 268px: below that a tile cannot
// hold a reading and its supporting rows side by side.

// Tiles cascade in rather than all landing at once. The step stays short and
// caps early: a fleet of forty fridges must not take two seconds to appear.
const TILE_STAGGER_MS = 40;
const TILE_STAGGER_MAX = 8;

type Props = {
  sensors: Sensor[];
  configBySensor: Map<string, AlertConfig>;
  activeAlertSensorIds: Set<string>;
  timezone: string;
  now: number;
};

export function SensorGrid({ sensors, configBySensor, activeAlertSensorIds, timezone, now }: Props) {
  return (
    <div className={SENSOR_GRID}>
      {sensors.map((sensor, i) => (
        <div
          key={sensor.id}
          className="animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]"
          style={{ animationDelay: `${Math.min(i, TILE_STAGGER_MAX) * TILE_STAGGER_MS}ms` }}
        >
          <SensorCard
            sensor={sensor}
            alertConfig={configBySensor.get(sensor.id)}
            hasActiveAlert={activeAlertSensorIds.has(sensor.id)}
            timezone={timezone}
            now={now}
          />
        </div>
      ))}
    </div>
  );
}
