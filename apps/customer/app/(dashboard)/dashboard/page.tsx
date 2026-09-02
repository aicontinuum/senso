import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { SensorCard } from "@/components/dashboard/SensorCard";
import { AutoRefresh } from "@/components/auto-refresh";
import { isGatewayOnline, isSensorOnline } from "@senso/status";
import type { Sensor, AlertConfig } from "@senso/types";

// The design system fixes the sensor tile floor at 268px: below that a tile
// cannot hold a reading and its supporting rows side by side.
const SENSOR_GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]";

export default async function DashboardPage() {
  const customer = await requireCustomer();

  const supabase = await createClient();

  const { data: gateways } = await supabase
    .from("gateways")
    .select("id, name, is_online, last_seen_at, sensors (id, name, status, battery_level, decommissioned_at, commissioned_at)")
    .eq("customer_id", customer.id)
    .is("decommissioned_at", null);

  // Retired sensors keep their readings for the compliance record but must not
  // appear as live devices.
  const allSensors = (gateways ?? []).flatMap(
    (g) => (g.sensors ?? [])
      .filter((s: { decommissioned_at: string | null }) => s.decommissioned_at === null)
      .map((s: {
        id: string;
        name: string;
        status: string;
        battery_level: number | null;
        commissioned_at: string | null;
      }) => ({
        ...s,
        gatewayId: g.id,
      })),
  );
  const sensorIds = allSensors.map((s) => s.id);

  // alert_configs link alert_logs to sensors
  const { data: allAlertConfigs } = sensorIds.length > 0
    ? await supabase.from("alert_configs").select("id, sensor_id, type, threshold, email_recipients").in("sensor_id", sensorIds)
    : { data: [] as { id: string; sensor_id: string; type: string; threshold: number; email_recipients: string[] | null }[] };

  const alertConfigIds = (allAlertConfigs ?? []).map((c) => c.id);
  const configToSensor = new Map((allAlertConfigs ?? []).map((c) => [c.id, c.sensor_id]));

  const [{ data: lastReadings }, { data: activeAlertLogs }, { data: recentAlertLogs }] =
    await Promise.all([
      sensorIds.length > 0
        ? supabase.from("readings").select("id, sensor_id, temperature, recorded_at").in("sensor_id", sensorIds).order("recorded_at", { ascending: false }).limit(sensorIds.length * 5)
        : { data: [] as { id: string; sensor_id: string; temperature: number; recorded_at: string }[] },
      alertConfigIds.length > 0
        ? supabase.from("alert_logs").select("alert_config_id").in("alert_config_id", alertConfigIds).eq("is_resolved", false)
        : { data: [] as { alert_config_id: string }[] },
      alertConfigIds.length > 0
        ? supabase.from("alert_logs").select("alert_config_id").in("alert_config_id", alertConfigIds).gte("triggered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        : { data: [] as { alert_config_id: string }[] },
    ]);

  // Last reading per sensor
  const lastReadingBySensor = new Map<string, { id: string; temperature: number; recorded_at: string }>();
  for (const r of lastReadings ?? []) {
    if (!lastReadingBySensor.has(r.sensor_id)) lastReadingBySensor.set(r.sensor_id, r);
  }

  // Active alert sensor IDs (via config mapping)
  const activeAlertSensorIds = new Set(
    (activeAlertLogs ?? []).map((a) => configToSensor.get(a.alert_config_id)).filter(Boolean) as string[],
  );
  const recentAlertCount = (recentAlertLogs ?? []).length;

  // Derive online/offline from data freshness — a silent gateway/sensor never
  // sends an explicit offline signal, so stale data means offline.
  const sensorOnlineById = new Map(
    allSensors.map((s) => [s.id, isSensorOnline(s.status, lastReadingBySensor.get(s.id)?.recorded_at)]),
  );
  // The headline counts describe live monitoring, so a sensor that has not been
  // commissioned belongs in neither tally — counting one as "offline" would read
  // as a fault on a device that is working exactly as expected.
  const inServiceSensors = allSensors.filter((s) => s.commissioned_at !== null);
  const pendingCount = allSensors.length - inServiceSensors.length;
  const onlineCount = inServiceSensors.filter((s) => sensorOnlineById.get(s.id)).length;
  const offlineCount = inServiceSensors.length - onlineCount;
  const hasGateway = (gateways ?? []).length > 0;
  const gatewayOnline = (gateways ?? []).some((g) => isGatewayOnline(g.is_online, g.last_seen_at));

  
  const configMap = new Map<string, AlertConfig>();
  for (const sid of sensorIds) {
    const cfgs = (allAlertConfigs ?? []).filter((c) => c.sensor_id === sid);
    const belowMin = cfgs.find((c) => c.type === 'min');
    const aboveMax = cfgs.find((c) => c.type === 'max');
    if (cfgs.length > 0) {
      configMap.set(sid, {
        id: cfgs[0].id,
        sensorId: sid,
        minTemp: belowMin?.threshold ?? 2,
        maxTemp: aboveMax?.threshold ?? 8,
        emailRecipients: Array.isArray(cfgs[0].email_recipients) ? cfgs[0].email_recipients as string[] : [],
      });
    }
  }

  const sensors: Sensor[] = allSensors.map((s) => {
    const lr = lastReadingBySensor.get(s.id);
    return {
      id: s.id,
      gatewayId: s.gatewayId,
      customerId: customer.id,
      name: s.name,
      status: sensorOnlineById.get(s.id) ? 'online' : 'offline',
      batteryLevel: s.battery_level ?? undefined,
      commissionedAt: s.commissioned_at,
      lastReading: lr ? { id: lr.id, sensorId: s.id, temperature: lr.temperature, recordedAt: lr.recorded_at } : undefined,
    };
  });

  return (
    <div>
      <AutoRefresh />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/setup"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Device</span>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 divide-x rounded-lg border bg-card">
        <SummaryItem label="Gateway">
          {!hasGateway ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <span className={gatewayOnline ? "size-2 rounded-full bg-ok-500" : "size-2 rounded-full bg-offline-500"} />
              {gatewayOnline ? "Online" : "Offline"}
            </span>
          )}
        </SummaryItem>

        <SummaryItem label="Sensors">
          {allSensors.length === 0 ? (
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
      </div>

      {sensors.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No sensors yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a gateway and sensors to start monitoring.</p>
        </div>
      ) : (
        <div className={SENSOR_GRID}>
          {sensors.map((sensor) => (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              alertConfig={configMap.get(sensor.id)}
              hasActiveAlert={activeAlertSensorIds.has(sensor.id)}
              timezone={customer.timezone}
            />
          ))}
        </div>
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
