// Everything the dashboard shows, for one login. The clock is taken once
// here and returned, so every relative figure on the page agrees and the
// page component stays pure.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isGatewayOnline, isSensorOnline } from "@senso/status";
import { ALL_BRANCHES, BRANCH_PARAM, groupByBranch, hasBranches, selectedBranch, sortBranchesByAttention, type BranchTally } from "@/lib/branches";
import { loadScope, siteOfGateway, type Site, type ViewScope } from "@/lib/scope";
import type { CustomerRecord } from "@/lib/supabase/get-customer";
import type { Sensor, AlertConfig } from "@senso/types";

export type DashboardData = {
  now: number;
  scope: ViewScope;
  branches: Site[];
  multiBranch: boolean;
  /** The chosen site id, or ALL_BRANCHES. */
  branch: string;
  gatewayCount: number;
  gatewaysOnline: number;
  sensorCount: number;
  onlineCount: number;
  offlineCount: number;
  pendingCount: number;
  recentAlertCount: number;
  sensors: Sensor[];
  configBySensor: Map<string, AlertConfig>;
  activeAlertSensorIds: Set<string>;
  branchGroups: { branch: Site; items: Sensor[]; tally: BranchTally }[];
  /** Suspended member accounts, for an owner login: shown blurred, no data. */
  suspendedSites: Site[];
};

export async function loadDashboard(
  supabase: SupabaseClient,
  customer: CustomerRecord,
  params: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
): Promise<DashboardData> {
  const scope = await loadScope(supabase, customer);
  const { data: allGateways } = await supabase
    .from("gateways")
    .select("id, name, customer_id, branch_id, is_online, last_seen_at, sensors (id, name, status, battery_level, decommissioned_at, commissioned_at)")
    .in("customer_id", scope.customerIds)
    .is("decommissioned_at", null);
  const branches = scope.sites;
  const multiBranch = hasBranches(branches);
  const branch = selectedBranch(params[BRANCH_PARAM], branches);
  // Everything below is scoped to the chosen site, the summary bar included.
  const gateways = (allGateways ?? []).filter((g) => branch === ALL_BRANCHES || siteOfGateway(scope, g) === branch);

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
        branchId: siteOfGateway(scope, g),
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
        ? supabase.from("alert_logs").select("alert_config_id").in("alert_config_id", alertConfigIds).gte("triggered_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
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
    allSensors.map((s) => [s.id, isSensorOnline(s.status, lastReadingBySensor.get(s.id)?.recorded_at, now)]),
  );
  // The headline counts describe live monitoring, so a sensor that has not been
  // commissioned belongs in neither tally — counting one as "offline" would read
  // as a fault on a device that is working exactly as expected.
  const inServiceSensors = allSensors.filter((s) => s.commissioned_at !== null);
  const pendingCount = allSensors.length - inServiceSensors.length;
  const onlineCount = inServiceSensors.filter((s) => sensorOnlineById.get(s.id)).length;
  const offlineCount = inServiceSensors.length - onlineCount;
  const gatewayCount = gateways.length;
  const gatewaysOnline = gateways.filter((g) => isGatewayOnline(g.is_online, g.last_seen_at)).length;

  
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

  const branchOfSensor = new Map(allSensors.map((s) => [s.id, s.branchId]));
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

  // Per-branch counts for the headings on All: the same rules as the summary
  // bar, so a heading never disagrees with the bar above it.
  const tallyOf = (items: Sensor[]): BranchTally => {
    const inService = items.filter((s) => s.commissionedAt !== null);
    const online = inService.filter((s) => s.status === "online").length;
    return { online, offline: inService.length - online, alerts: items.filter((s) => activeAlertSensorIds.has(s.id)).length };
  };
  const branchGroups = sortBranchesByAttention(
    groupByBranch(branches, sensors, (s) => branchOfSensor.get(s.id) ?? "").map((g) => ({ ...g, tally: tallyOf(g.items) })),
    (g) => g.tally,
  );


  return {
    now, scope, branches, multiBranch, branch, gatewayCount, gatewaysOnline,
    sensorCount: allSensors.length, onlineCount, offlineCount, pendingCount, recentAlertCount,
    sensors, configBySensor: configMap, activeAlertSensorIds, branchGroups,
    suspendedSites: scope.suspendedSites,
  };
}
