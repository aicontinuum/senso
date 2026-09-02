import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSensorOnline } from '@senso/status';
import { SensorSettingsClient } from './SensorSettingsClient';
import { CommissioningPanel } from './CommissioningPanel';

export default async function SensorSettingsPage({
  params,
}: {
  params: Promise<{ id: string; sensorId: string }>;
}) {
  const { id: customerId, sensorId } = await params;
  const admin = createAdminClient();

  const { data: sensor } = await admin
    .from('sensors')
    .select('id, name, status, battery_level, hardware_id, commissioned_at, gateway_id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .is('decommissioned_at', null)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customerId) {
    notFound();
  }

  const { data: gateways } = await admin
    .from('gateways')
    .select('id, name')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  // Freshness-based status, same rules as everywhere else — the raw flag
  // never flips for a sensor that dies silently.
  const { data: latestReading } = await admin
    .from('readings')
    .select('recorded_at')
    .eq('sensor_id', sensorId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: alertConfigs } = await admin
    .from('alert_configs')
    .select('type, threshold')
    .eq('sensor_id', sensorId);

  const belowMin = alertConfigs?.find(c => c.type === 'min');
  const aboveMax = alertConfigs?.find(c => c.type === 'max');
  return (
    <div className="space-y-6">
      <SensorSettingsClient
        customerId={customerId}
        sensor={{
          id: sensor.id,
          name: sensor.name,
          status: isSensorOnline(sensor.status, latestReading?.recorded_at) ? 'online' : 'offline',
          gatewayId: sensor.gateway_id,
          hardwareId: sensor.hardware_id ?? '',
          minTemp: belowMin?.threshold ?? 2,
          maxTemp: aboveMax?.threshold ?? 8,
        }}
        gateways={(gateways ?? []).map(g => ({ id: g.id, name: g.name ?? g.id }))}
      />
      <CommissioningPanel
        customerId={customerId}
        sensorId={sensor.id}
        commissionedAt={sensor.commissioned_at}
      />
    </div>
  );
}
