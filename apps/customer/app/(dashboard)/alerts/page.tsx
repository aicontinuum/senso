import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AlertsPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/login");

  const supabase = await createClient();

  // Get all sensor IDs for this customer (via their gateways)
  const { data: gateways } = await supabase
    .from("gateways")
    .select("sensors (id, name)")
    .eq("customer_id", customer.id);

  const sensors = (gateways ?? []).flatMap(
    (g) => (g.sensors ?? []) as { id: string; name: string }[],
  );
  const sensorIds = sensors.map((s) => s.id);
  const sensorNameById = new Map(sensors.map((s) => [s.id, s.name]));

  const { data: alertLogs } = sensorIds.length > 0
    ? await supabase
        .from("alert_logs")
        .select("id, sensor_id, triggered_at, resolved_at")
        .in("sensor_id", sensorIds)
        .order("triggered_at", { ascending: false })
    : { data: [] as { id: string; sensor_id: string; triggered_at: string; resolved_at: string | null }[] };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alerts</h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Sensor</th>
              <th className="px-4 py-3">Triggered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(alertLogs ?? []).map((alert) => (
              <tr key={alert.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">
                  {sensorNameById.get(alert.sensor_id) ?? alert.sensor_id}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(alert.triggered_at)}
                </td>
                <td className="px-4 py-3">
                  {alert.resolved_at ? (
                    <span className="text-muted-foreground">Resolved</span>
                  ) : (
                    <span className="font-medium text-red-600">Active</span>
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
            ))}
            {(alertLogs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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
