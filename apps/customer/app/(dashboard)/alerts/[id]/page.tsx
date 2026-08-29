import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rangeAt, type ThresholdVersion } from "@/lib/thresholds";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { formatDateTimeLong } from "@/lib/temperature";
import { TemperatureChart } from "@/components/alerts/TemperatureChart";

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await requireCustomer();

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
    .is("decommissioned_at", null)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customer.id) notFound();

  // Both min and max thresholds for the chart, resolved to the versions that were
  // in force when the alert fired rather than to today's values — otherwise a
  // later threshold edit rewrites what this alert says triggered it.
  const { data: allConfigs } = await supabase
    .from("alert_configs")
    .select("type, threshold, alert_threshold_history (threshold, effective_from, effective_to)")
    .eq("sensor_id", alertConfig.sensor_id);

  const versions: ThresholdVersion[] = (allConfigs ?? []).flatMap((c) =>
    ((c.alert_threshold_history ?? []) as {
      threshold: number; effective_from: string; effective_to: string | null;
    }[]).map((v) => ({
      type: c.type as "min" | "max",
      threshold: v.threshold,
      effectiveFrom: v.effective_from,
      effectiveTo: v.effective_to,
    })),
  );

  const applied = rangeAt(versions, alertLog.triggered_at);
  const belowMin = (allConfigs ?? []).find((c) => c.type === "min");
  const aboveMax = (allConfigs ?? []).find((c) => c.type === "max");
  // Falls back to the current value only where no version covers the trigger
  // instant, which can only happen for alerts predating the history backfill.
  const minTemp = applied.min ?? belowMin?.threshold ?? 2;
  const maxTemp = applied.max ?? aboveMax?.threshold ?? 8;

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

  const closestReading = (readings ?? []).reduce<{ temperature: number; recorded_at: string } | null>((best, r) => {
    if (!best) return r;
    const diffR = Math.abs(new Date(r.recorded_at).getTime() - alertTime);
    const diffBest = Math.abs(new Date(best.recorded_at).getTime() - alertTime);
    return diffR < diffBest ? r : best;
  }, null);
  const triggeringTemp = closestReading?.temperature;

  // Short "DD/MM, HH:MM" chart labels rendered in the customer's timezone
  const chartLabelFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: customer.timezone,
  });
  const chartData = (readings ?? []).map((r) => ({
    time: chartLabelFmt.format(new Date(r.recorded_at)),
    temp: r.temperature,
  }));

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
          {" · "}{formatDateTimeLong(alertLog.triggered_at, customer.timezone)}
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
            minTemp={minTemp}
            maxTemp={maxTemp}
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
