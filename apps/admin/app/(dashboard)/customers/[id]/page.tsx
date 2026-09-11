import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGatewayOnline, isSensorOnline, SENSOR_STALE_MS } from '@senso/status';
import { CustomerDetailClient } from './CustomerDetailClient';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const now = Date.now();

  const { data: customer } = await admin
    .from('customers')
    .select('id, name, email, contact_name, phone, status, created_at, alert_recipients')
    .eq('id', id)
    .single();

  if (!customer) notFound();

  const { data: gateways } = await admin
    .from('gateways')
    .select('id, name, is_online, firmware_version, last_seen_at, mac_address')
    .eq('customer_id', id)
    .is('decommissioned_at', null)
    .order('created_at', { ascending: true });

  const gatewayIds = (gateways ?? []).map(g => g.id);

  // Retired sensors keep their readings for the compliance record but are not
  // listed as live devices.
  const { data: sensors } = gatewayIds.length > 0
    ? await admin.from('sensors').select('id, name, status, gateway_id, commissioned_at').in('gateway_id', gatewayIds).is('decommissioned_at', null)
    : { data: [] as { id: string; name: string; status: string; gateway_id: string; commissioned_at: string | null }[] };

  // Freshness-based status, same rules as the customer site — the raw
  // is_online/status flags never flip for a device that dies silently.
  const sensorIds = (sensors ?? []).map(s => s.id);
  const freshReadingBySensor = new Map<string, string>();
  // Battery is the voltage on the latest reading, exactly as the customer site
  // shows it. `sensors.battery_level` is a leftover from the prototype kit that
  // nothing has written since the LoRaWAN migration. One small query per sensor,
  // because a single shared limit would let a busy sensor crowd a silent one's
  // last reading out of the window.
  const batteryBySensor = new Map<string, number | null>();
  if (sensorIds.length > 0) {
    const sinceStale = new Date(now - SENSOR_STALE_MS).toISOString();
    const [{ data: freshReadings }, latestReadings] = await Promise.all([
      admin
        .from('readings')
        .select('sensor_id, recorded_at')
        .in('sensor_id', sensorIds)
        .gte('recorded_at', sinceStale),
      Promise.all(sensorIds.map(sensorId =>
        admin
          .from('readings')
          .select('sensor_id, battery_v')
          .eq('sensor_id', sensorId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )),
    ]);
    for (const r of freshReadings ?? []) freshReadingBySensor.set(r.sensor_id, r.recorded_at);
    for (const { data } of latestReadings) {
      if (data) batteryBySensor.set(data.sensor_id, data.battery_v);
    }
  }

  const gatewayRows = (gateways ?? []).map(g => ({
    ...g,
    is_online: isGatewayOnline(g.is_online, g.last_seen_at),
  }));
  const sensorRows = (sensors ?? []).map(s => ({
    ...s,
    status: isSensorOnline(s.status, freshReadingBySensor.get(s.id)) ? 'online' : 'offline',
    battery_v: batteryBySensor.get(s.id) ?? null,
  }));

  return (
    <CustomerDetailClient
      customer={customer}
      gateways={gatewayRows}
      sensors={sensorRows}
      now={now}
    />
  );
}
