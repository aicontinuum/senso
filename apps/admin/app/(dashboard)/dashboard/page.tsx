import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGatewayOnline, isSensorOnline, SENSOR_STALE_MS } from '@senso/status';

type GatewayWithSensors = {
  id: string;
  is_online: boolean;
  last_seen_at: string | null;
  decommissioned_at: string | null;
  sensors?: { id: string; status: string; decommissioned_at: string | null }[];
};

// Retired devices keep their readings for the compliance record, but must not be
// listed or counted as live. Nested selects can't be filtered server-side here, so
// both levels are filtered on the way out.
function activeGateways(raw: unknown): GatewayWithSensors[] {
  return ((raw ?? []) as GatewayWithSensors[]).filter(g => g.decommissioned_at === null);
}

function activeSensors(g: GatewayWithSensors) {
  return (g.sensors ?? []).filter(s => s.decommissioned_at === null);
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: customers } = await admin
    .from('customers')
    .select('id, name, email, gateways (id, is_online, last_seen_at, decommissioned_at, sensors (id, status, decommissioned_at))')
    .order('name');

  // Collect all sensor IDs to look up alert configs
  const allSensorIds = (customers ?? []).flatMap(c =>
    activeGateways(c.gateways).flatMap(g => activeSensors(g).map(s => s.id)),
  );

  // Freshness-based status, same rules as the customer site: a sensor is
  // online only if it has a reading newer than the staleness cutoff, so one
  // bounded query for recent readings is all we need.
  const freshReadingBySensor = new Map<string, string>();
  if (allSensorIds.length > 0) {
    const sinceStale = new Date(Date.now() - SENSOR_STALE_MS).toISOString();
    const { data: freshReadings } = await admin
      .from('readings')
      .select('sensor_id, recorded_at')
      .in('sensor_id', allSensorIds)
      .gte('recorded_at', sinceStale);
    for (const r of freshReadings ?? []) freshReadingBySensor.set(r.sensor_id, r.recorded_at);
  }

  // alert_logs links to alert_configs, not sensors directly
  let totalAlerts = 0;
  const alertsBySensorId = new Map<string, number>();

  if (allSensorIds.length > 0) {
    const { data: alertConfigs } = await admin
      .from('alert_configs')
      .select('id, sensor_id')
      .in('sensor_id', allSensorIds);

    const configIds = (alertConfigs ?? []).map(c => c.id);
    const configToSensor = new Map((alertConfigs ?? []).map(c => [c.id, c.sensor_id]));

    if (configIds.length > 0) {
      const { data: recentLogs } = await admin
        .from('alert_logs')
        .select('alert_config_id')
        .in('alert_config_id', configIds)
        .gte('triggered_at', since24h);

      totalAlerts = (recentLogs ?? []).length;
      for (const log of recentLogs ?? []) {
        const sid = configToSensor.get(log.alert_config_id);
        if (sid) alertsBySensorId.set(sid, (alertsBySensorId.get(sid) ?? 0) + 1);
      }
    }
  }

  let sensorsOnline = 0;
  let sensorsOffline = 0;

  const rows = (customers ?? []).map(customer => {
    const gateways = activeGateways(customer.gateways);
    const sensors = gateways.flatMap(activeSensors);

    for (const s of sensors) {
      if (isSensorOnline(s.status, freshReadingBySensor.get(s.id))) sensorsOnline++; else sensorsOffline++;
    }

    const alertCount = sensors.reduce((sum, s) => sum + (alertsBySensorId.get(s.id) ?? 0), 0);
    return { customer, gateways, sensorCount: sensors.length, alertCount };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-3 divide-x rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Customers</p>
          <p className="mt-1 text-3xl font-bold">{(customers ?? []).length}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Sensors</p>
          <p className="mt-1 text-3xl font-bold">{sensorsOnline + sensorsOffline}</p>
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <p><span className="font-medium text-ok-text">{sensorsOnline}</span> online</p>
            <p><span className="font-medium text-alert-text">{sensorsOffline}</span> offline</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Alerts (past 24h)</p>
          <p className={`mt-1 text-3xl font-bold ${totalAlerts > 0 ? 'text-alert-text' : ''}`}>{totalAlerts}</p>
          <p className="mt-2 text-sm text-muted-foreground">across all customers</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4"><h2 className="font-semibold">Customers</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Gateway</th>
                <th className="px-6 py-3 font-medium">Sensors</th>
                <th className="px-6 py-3 font-medium">Alerts (past 24h)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No customers yet.</td></tr>
              )}
              {rows.map(({ customer, gateways, sensorCount, alertCount }) => (
                <tr key={customer.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">{customer.name}</Link>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {gateways.length > 0 ? gateways.map(g => {
                      const online = isGatewayOnline(g.is_online, g.last_seen_at);
                      return (
                        <span key={g.id} className="flex items-center gap-1.5 text-sm">
                          <span className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-ok-500' : 'bg-offline-500'}`} />
                          {online ? 'Online' : 'Offline'}
                        </span>
                      );
                    }) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-4 tabular-nums">{sensorCount}</td>
                  <td className="px-6 py-4 tabular-nums">
                    {alertCount > 0
                      ? <span className="font-medium text-alert-text">{alertCount}</span>
                      : <span className="text-muted-foreground">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
