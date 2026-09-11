import type { Gateway } from "@senso/types";
import { formatAgo } from "@senso/status";
import { Badge } from "@senso/ui";
import { formatReadingTime } from "@/lib/temperature";
import { SettingsCard } from "./SettingsCard";

// Read-only: the gateway is installed and named by the technician, and there
// is nothing a customer can change about it. This is where they see whether
// their site is talking to us.
export function GatewaysSection({
  gateways,
  timezone,
  now,
}: {
  gateways: Gateway[];
  timezone: string;
  now: number;
}) {
  return (
    <SettingsCard title="Gateways">
      {gateways.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gateway installed yet.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {gateways.map((gw) => {
            const online = gw.status === "online";
            return (
              <div key={gw.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{gw.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {gw.firmwareVersion !== "—" ? `Firmware ${gw.firmwareVersion} · ` : ""}
                    <span title={formatReadingTime(gw.lastSeen, timezone)}>
                      {online ? "Updated" : "Last seen"} {formatAgo(gw.lastSeen, now)}
                    </span>
                  </p>
                </div>
                <Badge variant={online ? "ok" : "offline"} dot className="shrink-0">
                  {online ? "Online" : "Offline"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}
