import { Card, StatusDot } from "@senso/ui";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { SensorGrid } from "@/components/dashboard/SensorGrid";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { BranchHeading } from "@/components/dashboard/BranchHeading";
import { SuspendedSite } from "@/components/dashboard/SuspendedSite";
import { AutoRefresh } from "@/components/auto-refresh";
import { ALL_BRANCHES } from "@/lib/branches";
import { loadDashboard } from "@/lib/dashboard/load";
import type { Sensor } from "@senso/types";

// With one site the page is a summary bar and a grid of tiles. With more
// (several branches, or an owner login over several accounts), a dropdown
// sits beside the page title and, on All, the tiles are grouped under a
// heading per site that carries the site's own counts, sites with trouble
// first; the summary bar counts whatever is shown.

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const customer = await requireCustomer();
  const supabase = await createClient();
  const {
    now, scope, branches, multiBranch, branch, gatewayCount, gatewaysOnline,
    sensorCount, onlineCount, offlineCount, pendingCount, recentAlertCount,
    sensors, configBySensor, activeAlertSensorIds, branchGroups, suspendedSites,
  } = await loadDashboard(supabase, customer, await searchParams);
  // An owner with only suspended members still has something to show.
  const anySite = multiBranch || suspendedSites.length > 0;

  const grid = (items: Sensor[]) => (
    <SensorGrid sensors={items} configBySensor={configBySensor} activeAlertSensorIds={activeAlertSensorIds} timezone={customer.timezone} now={now} />
  );

  return (
    <div>
      <AutoRefresh />
      {/* The branch dropdown takes the page's action slot: it is the one
          control on the page, and it scopes everything under it, the
          summary bar included. Adding devices is the technician's job. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {multiBranch && (
          <BranchFilter
            branches={branches}
            selected={branch}
            label={scope.isGroup ? "Account" : "Branch"}
            allLabel={scope.isGroup ? "All accounts" : "All branches"}
            className="w-full sm:w-64"
          />
        )}
      </div>

      {/* One card, hairline-divided into three, so the summary reads as a
          single instrument rather than three boxes. */}
      <Card className="mb-6 grid grid-cols-3 divide-x divide-hairline overflow-hidden">
        <SummaryItem label={gatewayCount > 1 ? "Gateways" : "Gateway"}>
          {gatewayCount === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            // One gateway is online or offline. Several are counted, so one
            // dark site is never hidden behind another that is fine.
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <StatusDot status={gatewaysOnline === gatewayCount ? "ok" : "offline"} className="size-2" />
              {gatewayCount === 1
                ? (gatewaysOnline === 1 ? "Online" : "Offline")
                : `${gatewaysOnline} of ${gatewayCount} online`}
            </span>
          )}
        </SummaryItem>

        <SummaryItem label="Sensors">
          {sensorCount === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            <span className="text-sm font-medium">
              <span className="text-ok-text">{onlineCount} online</span>
              {offlineCount > 0 && <> · <span className="text-offline-text">{offlineCount} offline</span></>}
              {pendingCount > 0 && (
                <> · <span className="text-offline-text">{pendingCount} not in service</span></>
              )}
            </span>
          )}
        </SummaryItem>

        <SummaryItem label="Alerts (past 24h)">
          {recentAlertCount > 0 ? (
            <span className="text-sm font-medium text-alert-text">{recentAlertCount} alert{recentAlertCount > 1 ? "s" : ""}</span>
          ) : (
            <span className="text-sm font-medium text-ok-text">None</span>
          )}
        </SummaryItem>
      </Card>

      <h2 className="mb-3 text-lg font-semibold tracking-tight">Sensors</h2>

      {sensors.length === 0 && suspendedSites.length === 0 ? (
        // Three different reasons for an empty page, said apart: an owner
        // login with no accounts linked yet, an owner whose accounts have
        // nothing installed, and an ordinary account with no devices. An
        // owner whose only accounts are suspended is not empty: it sees
        // them named and blurred below.
        <div className="rounded-card border border-dashed px-6 py-12 text-center">
          {scope.isGroup && scope.sites.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">No accounts are linked to this login yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Senso links the accounts this login should see. Their sensors appear here once it does.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No sensors yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scope.isGroup ? "Nothing is installed in the linked accounts yet." : "Add a gateway and sensors to start monitoring."}
              </p>
            </>
          )}
        </div>
      ) : anySite && branch === ALL_BRANCHES ? (
        // Every branch, each under its own heading with its own counts, sites
        // with trouble first, so the eye finds a site before it finds a fridge.
        <div className="space-y-8">
          {branchGroups.map(({ branch: b, items, tally }) => (
            <section key={b.id} aria-label={b.name}>
              <BranchHeading name={b.name} tally={tally} />
              {items.length === 0
                ? <p className="text-sm text-muted-foreground">{scope.isGroup ? "No sensors in this account." : "No sensors at this branch."}</p>
                : grid(items)}
            </section>
          ))}
          {suspendedSites.map((site) => <SuspendedSite key={site.id} name={site.name} />)}
        </div>
      ) : (
        grid(sensors)
      )}
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-4 sm:px-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
