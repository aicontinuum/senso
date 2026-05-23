import Link from "next/link";
import type { Sensor } from "@senso/types";
import { cn } from "@/lib/utils";

export function SensorsSection({ sensors }: { sensors: Sensor[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sensors
      </p>
      <div className="space-y-0.5">
        {sensors.map((sensor) => (
          <Link
            key={sensor.id}
            href={`/sensors/${sensor.id}`}
            className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-accent"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  sensor.status === "online" ? "bg-green-500" : "bg-zinc-400",
                )}
              />
              <span className="text-sm font-medium">{sensor.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">→</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        New unassigned sensors will appear here when a device is first connected.
      </p>
    </section>
  );
}
