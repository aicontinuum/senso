import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SensorSettingsClient } from './SensorSettingsClient';

export default async function SensorSettingsPage({
  params,
}: {
  params: Promise<{ id: string; sensorId: string }>;
}) {
  const { id: customerId, sensorId } = await params;
  const admin = createAdminClient();

  const { data: sensor } = await admin
    .from('sensors')
    .select('id, name, status, battery_level, hardware_id, gateway_id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customerId) {
    notFound();
  }

  const { data: gateways } = await admin
    .from('gateways')
    .select('id, name')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  const { data: alertConfigs } = await admin
    .from('alert_configs')
    .select('type, threshold')
    .eq('sensor_id', sensorId);

  const belowMin = alertConfigs?.find(c => c.type === 'below_min');
  const aboveMax = alertConfigs?.find(c => c.type === 'above_max');

  return (
    <SensorSettingsClient
      customerId={customerId}
      sensor={{
        id: sensor.id,
        name: sensor.name,
        status: sensor.status,
        gatewayId: sensor.gateway_id,
        hardwareId: sensor.hardware_id ?? '',
        minTemp: belowMin?.threshold ?? 2,
        maxTemp: aboveMax?.threshold ?? 8,
      }}
      gateways={(gateways ?? []).map(g => ({ id: g.id, name: g.name ?? g.id }))}
    />
  );
}
