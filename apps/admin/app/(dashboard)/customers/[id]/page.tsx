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
    ? await admin.from('sensors').select('id, name, status, battery_level, gateway_id, commissioned_at').in('gateway_id', gatewayIds).is('decommissioned_at', null)
    : { data: [] as { id: string; name: string; status: string; battery_level: number | null; gateway_id: string; commissioned_at: string | null }[] };

  // Freshness-based status, same rules as the customer site — the raw
  // is_online/status flags never flip for a device that dies silently.
  const sensorIds = (sensors ?? []).map(s => s.id);
  const freshReadingBySensor = new Map<string, string>();
  if (sensorIds.length > 0) {
    const sinceStale = new Date(Date.now() - SENSOR_STALE_MS).toISOString();
    const { data: freshReadings } = await admin
      .from('readings')
      .select('sensor_id, recorded_at')
      .in('sensor_id', sensorIds)
      .gte('recorded_at', sinceStale);
    for (const r of freshReadings ?? []) freshReadingBySensor.set(r.sensor_id, r.recorded_at);
  }

  const gatewayRows = (gateways ?? []).map(g => ({
    ...g,
    is_online: isGatewayOnline(g.is_online, g.last_seen_at),
  }));
  const sensorRows = (sensors ?? []).map(s => ({
    ...s,
    status: isSensorOnline(s.status, freshReadingBySensor.get(s.id)) ? 'online' : 'offline',
  }));

  return (
    <CustomerDetailClient
      customer={customer}
      gateways={gatewayRows}
      sensors={sensorRows}
    />
  );
}
