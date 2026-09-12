import { createAdminClient } from '@/lib/supabase/admin';
import { isGatewayOnline, isSensorOnline, SENSOR_STALE_MS } from '@senso/status';
import { PLATFORM_STATUS_COLUMNS, type PlatformStatusRow } from '@/lib/platform-status';
import { PlatformWatchdogCard } from '@/components/dashboard/PlatformWatchdogCard';
import { CustomerFleetTable, type FleetRow } from '@/components/dashboard/CustomerFleetTable';
import { Card } from '@senso/ui';

const STAT_TILE = 'px-4 py-4 sm:px-6 sm:py-5';
const STAT_VALUE = 'mt-1 font-display text-3xl font-bold tabular-nums';

type GatewayWithSensors = {
  id: string;
  is_online: boolean;
  last_seen_at: string | null;
  decommissioned_at: string | null;
  sensors?: { id: string; status: string; decommissioned_at: string | null; commissioned_at: string | null }[];
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

// Highest first. A dark site outranks everything: no readings means no
// monitoring and no record, whatever else the row says.
function attentionRank(row: FleetRow): number {
  if (row.gateways.some(g => !g.online)) return 3;
  if (row.alertCount > 0) return 2;
  if (row.sensorsOffline > 0) return 1;
  return 0;
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: customers }, { data: platformStatus, error: platformError }] = await Promise.all([
    admin
      .from('customers')
      .select('id, name, email, gateways (id, is_online, last_seen_at, decommissioned_at, sensors (id, status, decommissioned_at, commissioned_at))')
      .order('name'),
    admin.from('platform_status').select(PLATFORM_STATUS_COLUMNS).eq('id', true).maybeSingle(),
  ]);

  // An unreadable status row renders the card as "never heard from", which is
  // the honest reading: this page cannot claim the platform is fine on a query
  // that failed. Logged so the cause is findable.
  if (platformError) console.error('[dashboard] could not read platform_status', platformError);

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

  const rows: FleetRow[] = (customers ?? []).map(customer => {
    const liveGateways = activeGateways(customer.gateways);
    const sensors = liveGateways.flatMap(activeSensors);
    const row: FleetRow = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      gateways: liveGateways.map(g => ({
        id: g.id,
        online: isGatewayOnline(g.is_online, g.last_seen_at),
        lastSeenAt: g.last_seen_at,
      })),
      sensorsOnline: 0,
      sensorsOffline: 0,
      sensorsPending: 0,
      alertCount: sensors.reduce((sum, s) => sum + (alertsBySensorId.get(s.id) ?? 0), 0),
    };
    // A sensor registered but never marked as installed is a customer with no
    // monitoring and no record — the quiet half of a botched install. It
    // belongs on this page rather than waiting to be noticed.
    for (const s of sensors) {
      if (s.commissioned_at === null) row.sensorsPending++;
      else if (isSensorOnline(s.status, freshReadingBySensor.get(s.id))) row.sensorsOnline++;
      else row.sensorsOffline++;
    }
    return row;
  });

  // Fleet-wide totals for the tiles, summed from the rows so the two can never
  // disagree. Customers are no longer emailed when a gateway goes quiet — that
  // signal is derived from their own readings, and a dark site is our problem
  // to fix, not theirs to be woken about. "Sites dark" is where it surfaces.
  const sum = (pick: (row: FleetRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const sitesDark = sum(row => row.gateways.filter(g => !g.online).length);
  const sensorsOnline = sum(row => row.sensorsOnline);
  const sensorsOffline = sum(row => row.sensorsOffline);
  const sensorsPending = sum(row => row.sensorsPending);

  // Customers who need attention come first: a dark site, then alerts, then
  // offline sensors, and only then the alphabet. On an ops page the order is
  // part of the information.
  rows.sort((a, b) =>
    attentionRank(b) - attentionRank(a)
    || b.alertCount - a.alertCount
    || b.sensorsOffline - a.sensorsOffline
    || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <PlatformWatchdogCard status={(platformStatus as PlatformStatusRow | null) ?? null} now={now} />

      {/* One card, hairline-divided into tiles, so the four numbers read as one
          row of the same instrument rather than four unrelated boxes. */}
      <Card className="grid grid-cols-2 divide-hairline overflow-hidden sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-b-0">
        <div className={STAT_TILE}>
          <p className="text-sm font-medium text-muted-foreground">Customers</p>
          <p className={STAT_VALUE}>{(customers ?? []).length}</p>
        </div>
        <div className={STAT_TILE}>
          <p className="text-sm font-medium text-muted-foreground">Sites dark</p>
          <p className={`${STAT_VALUE} ${sitesDark > 0 ? 'text-alert-text' : ''}`}>
            {sitesDark}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {sitesDark > 0 ? 'no readings arriving' : 'all gateways reporting'}
          </p>
        </div>
        <div className={STAT_TILE}>
          <p className="text-sm font-medium text-muted-foreground">Sensors</p>
          <p className={STAT_VALUE}>{sensorsOnline + sensorsOffline + sensorsPending}</p>
          {/* A count is tinted only when it is above zero: "0 offline" in alert
              red pulls the eye toward nothing, and the tile above already
              follows this rule for dark sites. */}
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <p><span className={`font-medium ${sensorsOnline > 0 ? 'text-ok-text' : ''}`}>{sensorsOnline}</span> online</p>
            <p><span className={`font-medium ${sensorsOffline > 0 ? 'text-alert-text' : ''}`}>{sensorsOffline}</span> offline</p>
            {sensorsPending > 0 && (
              <p><span className="font-medium text-warn-text">{sensorsPending}</span> awaiting commissioning</p>
            )}
          </div>
        </div>
        <div className={STAT_TILE}>
          <p className="text-sm font-medium text-muted-foreground">Alerts (past 24h)</p>
          <p className={`${STAT_VALUE} ${totalAlerts > 0 ? 'text-alert-text' : ''}`}>{totalAlerts}</p>
          <p className="mt-2 text-sm text-muted-foreground">across all customers</p>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Customers</h2>
        <CustomerFleetTable rows={rows} now={now} />
      </div>
    </div>
  );
}
