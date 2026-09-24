import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Sensor } from "@senso/types";
import { StatusDot } from "@senso/ui";
import { SettingsCard } from "./SettingsCard";
import { BranchGroups } from "./BranchGroups";

// Each row opens the sensor's own page, where the name and thresholds are
// edited. Adding or removing sensors is the technician's job, not the
// customer's, so there is no action here.
export function SensorsSection({ groups }: { groups: { name: string | null; sensors: Sensor[] }[] }) {
  return (
    <SettingsCard
      title="Sensors"
      description="Open a sensor to rename it or change its temperature limits."
    >
      <BranchGroups
        groups={groups.map((g) => ({ name: g.name, items: g.sensors }))}
        empty="No sensors installed yet."
        emptyInBranch="No sensors at this branch."
        renderList={(sensors) => (
          <div className="-mx-2 divide-y divide-hairline">
            {sensors.map((sensor) => (
              <Link
                key={sensor.id}
                href={`/sensors/${sensor.id}`}
                className="flex items-center justify-between gap-3 rounded-inner px-2 py-2.5 transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <StatusDot status={sensor.status === "online" ? "ok" : "offline"} className="size-2" />
                  <span className="truncate text-sm font-medium">{sensor.name}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-faint" />
              </Link>
            ))}
          </div>
        )}
      />
    </SettingsCard>
  );
}
