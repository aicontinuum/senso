import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";
import { TemperatureChart } from "@/components/alerts/TemperatureChart";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer();
  if (!customer) redirect("/login");

  const supabase = await createClient();

  const { data: alertLog } = await supabase
    .from("alert_logs")
    .select("id, alert_config_id, triggered_at, is_resolved")
    .eq("id", id)
    .single();

  if (!alertLog) notFound();

  // Get alert config to resolve sensor_id and thresholds
  const { data: alertConfig } = await supabase
    .from("alert_configs")
    .select("id, sensor_id, type, threshold")
    .eq("id", alertLog.alert_config_id)
    .single();

  if (!alertConfig) notFound();

  // Verify ownership: sensor must belong to a gateway owned by this customer
  const { data: sensor } = await supabase
    .from("sensors")
    .select("id, name, gateway_id, gateways!inner (customer_id)")
    .eq("id", alertConfig.sensor_id)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customer.id) notFound();

  // Get all configs for this sensor to derive both min and max thresholds for the chart
  const { data: allConfigs } = await supabase
    .from("alert_configs")
    .select("type, threshold")
    .eq("sensor_id", alertConfig.sensor_id);

  const belowMin = (allConfigs ?? []).find((c) => c.type === "min");
  const aboveMax = (allConfigs ?? []).find((c) => c.type === "max");
  const minTemp = belowMin?.threshold ?? 2;
  const maxTemp = aboveMax?.threshold ?? 8;

  // Fetch readings ±12h around the alert
  const alertTime = new Date(alertLog.triggered_at).getTime();
  const windowStart = new Date(alertTime - 12 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(alertTime + 12 * 60 * 60 * 1000).toISOString();

  const { data: readings } = await supabase
    .from("readings")
    .select("id, temperature, recorded_at")
    .eq("sensor_id", alertConfig.sensor_id)
    .gte("recorded_at", windowStart)
    .lte("recorded_at", windowEnd)
    .order("recorded_at", { ascending: true });

  const alertType: "max" | "min" =
    alertConfig.type === "max" ? "max" : "min";

  const threshold = alertConfig.threshold;

  const closestReading = (readings ?? []).reduce<{ temperature: number; recorded_at: string } | null>((best, r) => {
    if (!best) return r;
    const diffR = Math.abs(new Date(r.recorded_at).getTime() - alertTime);
    const diffBest = Math.abs(new Date(best.recorded_at).getTime() - alertTime);
    return diffR < diffBest ? r : best;
  }, null);
  const triggeringTemp = closestReading?.temperature;

  const chartData = (readings ?? []).map((r) => {
    const d = new Date(r.recorded_at);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const minute = String(d.getUTCMinutes()).padStart(2, "0");
    return { time: `${day}/${month}, ${hour}:${minute}`, temp: r.temperature };
  });

  return (
    <div>
      <Link
        href="/alerts"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Alerts
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">{sensor.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {alertType === "max" ? "Too high" : "Too low"}
          {triggeringTemp !== undefined && <> · {triggeringTemp}°C</>}
          {" · "}{formatDateTime(alertLog.triggered_at)}
          {alertLog.is_resolved && <> · Resolved</>}
        </p>
      </div>

      {chartData.length > 0 ? (
        <div className="rounded-lg border p-4">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            Temperature readings — {sensor.name}
          </p>
          <TemperatureChart
            data={chartData}
            threshold={threshold}
            alertType={alertType}
          />
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No readings available for this time window.
        </div>
      )}
    </div>
  );
}
