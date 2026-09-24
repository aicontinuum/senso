import type { Gateway } from "@senso/types";
import { formatAgo } from "@senso/status";
import { Badge } from "@senso/ui";
import { formatReadingTime } from "@/lib/temperature";
import { SettingsCard } from "./SettingsCard";
import { BranchGroups } from "./BranchGroups";

// Read-only: the gateway is installed and named by the technician, and there
// is nothing a customer can change about it. This is where they see whether
// their site is talking to us.
export function GatewaysSection({
  groups,
  timezone,
  now,
}: {
  groups: { name: string | null; gateways: Gateway[] }[];
  timezone: string;
  now: number;
}) {
  const multiBranch = groups.some((g) => g.name !== null);
  return (
    <SettingsCard
      title="Gateways"
      description={multiBranch
        ? "The hub at each branch that relays readings from its sensors."
        : "The hub at your site that relays readings from your sensors."}
    >
      <BranchGroups
        groups={groups.map((g) => ({ name: g.name, items: g.gateways }))}
        empty="No gateway installed yet."
        emptyInBranch="No gateway at this branch."
        renderList={(gateways) => (
          <div className="divide-y divide-hairline">
            {gateways.map((gw) => {
              const online = gw.status === "online";
              return (
                <div key={gw.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-semibold leading-snug">{gw.name}</p>
                    <p className="text-sm text-muted-foreground">
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
      />
    </SettingsCard>
  );
}
