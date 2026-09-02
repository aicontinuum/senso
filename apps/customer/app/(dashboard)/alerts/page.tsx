import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { formatDateTimeLong } from "@/lib/temperature";

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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Triggered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {alertRows.map((alert) => {
              const sensorId = alert.sensorId;
              return (
                <tr key={alert.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    {sensorId ? (sensorNameById.get(sensorId) ?? sensorId) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {alert.kind === "threshold" ? "Out of range" : "No readings"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTimeLong(alert.triggeredAt, customer.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    {alert.isResolved ? (
                      <span className="text-muted-foreground">Resolved</span>
                    ) : (
                      <span className="font-medium text-alert-text">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/alerts/${alert.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {alertRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No alerts recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
