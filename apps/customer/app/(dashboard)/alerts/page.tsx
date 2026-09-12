import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Card, LinkRow } from "@senso/ui";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { formatDateTimeLong } from "@/lib/temperature";

const TH = "px-6 py-3 font-medium";
const TD = "px-6 py-3";

export default async function AlertsPage() {
  const customer = await requireCustomer();

  const supabase = await createClient();

  const { data: gateways } = await supabase
    .from("gateways")
    .select("sensors (id, name, decommissioned_at)")
    .eq("customer_id", customer.id)
    .is("decommissioned_at", null);

  const sensors = (gateways ?? []).flatMap(
    (g) => ((g.sensors ?? []) as { id: string; name: string; decommissioned_at: string | null }[])
      .filter((s) => s.decommissioned_at === null) as { id: string; name: string }[],
  );
  const sensorIds = sensors.map((s) => s.id);
  const sensorNameById = new Map(sensors.map((s) => [s.id, s.name]));

  const { data: alertConfigs } = sensorIds.length > 0
    ? await supabase
        .from("alert_configs")
        .select("id, sensor_id")
        .in("sensor_id", sensorIds)
    : { data: [] as { id: string; sensor_id: string }[] };

  const alertConfigIds = (alertConfigs ?? []).map((c) => c.id);
  const configToSensorId = new Map((alertConfigs ?? []).map((c) => [c.id, c.sensor_id]));

  // Two queries because the two kinds reach a sensor by different columns: a
  // threshold alert through its alert_config, an offline alert directly. Until
  // now only the first was listed, so a customer could receive an email saying a
  // sensor had stopped reporting, open the app to look into it, and find nothing
  // — the alert existed only in their inbox.
  const [thresholdRes, offlineRes] = await Promise.all([
    alertConfigIds.length > 0
      ? supabase
          .from("alert_logs")
          .select("id, alert_config_id, triggered_at, is_resolved")
          .in("alert_config_id", alertConfigIds)
          .order("triggered_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; alert_config_id: string; triggered_at: string; is_resolved: boolean }[] }),
    sensorIds.length > 0
      ? supabase
          .from("alert_logs")
          .select("id, sensor_id, triggered_at, is_resolved")
          .in("sensor_id", sensorIds)
          .eq("kind", "sensor_offline")
          .order("triggered_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; sensor_id: string; triggered_at: string; is_resolved: boolean }[] }),
  ]);

  type AlertRow = {
    id: string;
    sensorId: string | undefined;
    kind: "threshold" | "sensor_offline";
    triggeredAt: string;
    isResolved: boolean;
  };

  const alertRows: AlertRow[] = [
    ...(thresholdRes.data ?? []).map((a) => ({
      id: a.id,
      sensorId: configToSensorId.get(a.alert_config_id),
      kind: "threshold" as const,
      triggeredAt: a.triggered_at,
      isResolved: a.is_resolved,
    })),
    ...(offlineRes.data ?? []).map((a) => ({
      id: a.id,
      sensorId: a.sensor_id,
      kind: "sensor_offline" as const,
      triggeredAt: a.triggered_at,
      isResolved: a.is_resolved,
    })),
  ].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alerts</h1>

      {alertRows.length === 0 ? (
        <div className="rounded-card border border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No alerts recorded.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Out-of-range readings and sensors that stop reporting will be listed here.
          </p>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted-foreground">
                <th className={TH}>Sensor</th>
                <th className={TH}>Type</th>
                <th className={TH}>Triggered</th>
                <th className={TH}>Status</th>
                <th className={`${TH} relative`}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {alertRows.map((alert) => {
                const sensorId = alert.sensorId;
                const href = `/alerts/${alert.id}`;
                return (
                  <LinkRow key={alert.id} href={href}>
                    <td className={`${TD} whitespace-nowrap font-medium`}>
                      {sensorId ? (sensorNameById.get(sensorId) ?? sensorId) : "—"}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                      {alert.kind === "threshold" ? "Out of range" : "No readings"}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                      {formatDateTimeLong(alert.triggeredAt, customer.timezone)}
                    </td>
                    <td className={TD}>
                      {/* An open alert is the one thing on this page that
                          needs attention, so it alone carries a tone. */}
                      {alert.isResolved ? (
                        <Badge variant="offline" dot>Resolved</Badge>
                      ) : (
                        <Badge variant="alert" dot>Active</Badge>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      <Button asChild variant="ghost" size="icon" aria-label="Open alert">
                        <Link href={href}>
                          <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    </td>
                  </LinkRow>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
