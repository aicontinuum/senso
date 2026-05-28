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
    .select("id, sensor_id, triggered_at, resolved_at")
    .eq("id", id)
    .single();

  if (!alertLog) notFound();

  // Verify ownership: sensor must belong to a gateway owned by this customer
  const { data: sensor } = await supabase
    .from("sensors")
    .select("id, name, gateway_id, gateways!inner (customer_id)")
    .eq("id", alertLog.sensor_id)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customer.id) notFound();

  // Fetch alert config for threshold
  const { data: config } = await supabase
    .from("alert_configs")
    .select("min_temp, max_temp")
    .eq("sensor_id", alertLog.sensor_id)
    .single();

  // Fetch readings ±12h around the alert
  const alertTime = new Date(alertLog.triggered_at).getTime();
  const windowStart = new Date(alertTime - 12 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(alertTime + 12 * 60 * 60 * 1000).toISOString();

  const { data: readings } = await supabase
    .from("readings")
    .select("id, temperature, recorded_at")
    .eq("sensor_id", alertLog.sensor_id)
    .gte("recorded_at", windowStart)
    .lte("recorded_at", windowEnd)
    .order("recorded_at", { ascending: true });

  // Derive alert type from readings near the trigger time vs thresholds
  const triggeringReading = (readings ?? []).reduce<{ temperature: number } | null>((closest, r) => {
    if (!config) return closest;
    const diff = Math.abs(new Date(r.recorded_at).getTime() - alertTime);
    if (!closest) return r;
    return diff < Math.abs(new Date((closest as { recorded_at?: string }).recorded_at ?? alertLog.triggered_at).getTime() - alertTime) ? r : closest;
  }, null);

  const temperature = triggeringReading?.temperature;
  const alertType: "above_max" | "below_min" =
    config && temperature !== undefined
      ? temperature > config.max_temp ? "above_max" : "below_min"
      : "above_max";

  const threshold = alertType === "above_max" ? (config?.max_temp ?? 0) : (config?.min_temp ?? 0);

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
          {alertType === "above_max" ? "Too high" : "Too low"}
          {temperature !== undefined && <> · {temperature}°C</>}
          {" · "}{formatDateTime(alertLog.triggered_at)}
          {alertLog.resolved_at && <> · Resolved {formatDateTime(alertLog.resolved_at)}</>}
        </p>
      </div>

      {chartData.length > 0 ? (
        <div className="rounded-lg border p-4">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            Temperature readings — {sensor.name}
          </p>
          <TemperatureChart data={chartData} threshold={threshold} alertType={alertType} />
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No readings available for this time window.
        </div>
      )}
    </div>
  );
}
