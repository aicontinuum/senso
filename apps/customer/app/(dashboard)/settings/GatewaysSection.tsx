import type { Gateway } from "@senso/types";
import { cn } from "@/lib/utils";
import { formatReadingTime } from "@/lib/temperature";

export function GatewaysSection({ gateways, timezone }: { gateways: Gateway[]; timezone: string }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Gateways
      </p>
      <div className="space-y-3">
        {gateways.map((gw) => (
          <div key={gw.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  gw.status === "online" ? "bg-green-500" : "bg-zinc-400",
                )}
              />
              <div>
                <p className="text-sm font-medium">{gw.name}</p>
                <p className="text-xs text-muted-foreground">
                  v{gw.firmwareVersion}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium",
                  gw.status === "online" ? "text-green-700" : "text-zinc-500",
                )}
              >
                {gw.status === "online" ? "Online" : "Offline"}
              </p>
              <p className="text-xs text-muted-foreground">
                Last seen {formatReadingTime(gw.lastSeen, timezone)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
