import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rangeAt, type ThresholdVersion } from "@/lib/thresholds";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { formatDateTimeLong, formatTemp } from "@/lib/temperature";
import { alertEpisode } from "@/lib/alert-episode";
import {
  ALERT_EPISODE_LEAD_MS,
  ALERT_EPISODE_MAX_POINTS,
  ALERT_EPISODE_FETCH_SLACK,
  ALERT_EPISODE_CONTEXT_READINGS,
} from "@/lib/constants";
import { TemperatureChart } from "@/components/alerts/TemperatureChart";
import { AlertComment } from "@/components/alerts/AlertComment";

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

  // Readings from a little before the alert onwards. Ascending with a limit
  // takes the start of the episode rather than an arbitrary slice of it, and
  // bounds the query for a breach that is still open and has no end yet.
  const alertTime = new Date(alertLog.triggered_at).getTime();
  const fetchFrom = new Date(alertTime - ALERT_EPISODE_LEAD_MS).toISOString();

  const { data: readings } = await supabase
    .from("readings")
    .select("id, temperature, recorded_at")
    .eq("sensor_id", alertConfig.sensor_id)
    .gte("recorded_at", fetchFrom)
    .order("recorded_at", { ascending: true })
    .limit(ALERT_EPISODE_MAX_POINTS + ALERT_EPISODE_FETCH_SLACK);

  const alertType: "max" | "min" =
    alertConfig.type === "max" ? "max" : "min";

  // Trim to the episode: the breaching run, plus a couple of in-range readings
  // either side of it. A fixed window showed twelve hours of unrelated readings
  // around a two-reading blip, and cut off any breach that outlasted it.
  const episode = alertEpisode(
    (readings ?? []).map((r) => ({ temperature: r.temperature, recordedAt: r.recorded_at })),
    alertLog.triggered_at,
    { min: minTemp, max: maxTemp },
    ALERT_EPISODE_CONTEXT_READINGS,
    ALERT_EPISODE_MAX_POINTS,
  );

  const nearestToTrigger = episode.readings.reduce<{ temperature: number; recordedAt: string } | null>(
    (best, r) => {
      if (!best) return r;
      const here = Math.abs(new Date(r.recordedAt).getTime() - alertTime);
      const bestGap = Math.abs(new Date(best.recordedAt).getTime() - alertTime);
      return here < bestGap ? r : best;
    },
    null,
  );
  const triggeringTemp = nearestToTrigger?.temperature;

  // The supervisor's note on this incident. Read through the user's session, so
  // RLS decides whether it is theirs to see.
  const { data: comment } = await supabase
    .from("alert_comments")
    .select("body, created_at, updated_at")
    .eq("alert_log_id", id)
    .maybeSingle();

  // Short "DD/MM, HH:MM" chart labels rendered in the customer's timezone
  const chartLabelFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: customer.timezone,
  });
  const chartData = episode.readings.map((r) => ({
    time: chartLabelFmt.format(new Date(r.recordedAt)),
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
          {triggeringTemp !== undefined && <> · {formatTemp(triggeringTemp)}</>}
          {" · "}{formatDateTimeLong(alertLog.triggered_at, customer.timezone)}
          {alertLog.is_resolved && <> · Resolved</>}
        </p>
      </div>

      {chartData.length > 0 ? (
        <div className="rounded-lg border p-4">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            {episode.breachCount === 1
              ? "1 reading out of range"
              : `${episode.breachCount} readings out of range`}
            {" · "}
            {chartData.length} shown
          </p>
          <TemperatureChart
            data={chartData}
            minTemp={minTemp}
            maxTemp={maxTemp}
            alertType={alertType}
          />
          {episode.truncated && (
            <p className="mt-3 text-xs text-muted-foreground">
              The breach continues past the last reading shown. Reports carry the
              full series.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No readings recorded around this alert.
        </div>
      )}

      <AlertComment
        alertId={id}
        initialBody={comment?.body ?? null}
        createdAt={comment?.created_at ?? null}
        updatedAt={comment?.updated_at ?? null}
        timezone={customer.timezone}
      />
    </div>
  );
}
