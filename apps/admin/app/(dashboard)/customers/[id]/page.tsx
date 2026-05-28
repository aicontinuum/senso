import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
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
    .select('id, name, email, contact_name, phone, status, created_at')
    .eq('id', id)
    .single();

  if (!customer) notFound();

  const { data: gateways } = await admin
    .from('gateways')
    .select('id, name, is_online, firmware_version, last_seen_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: true });

  const gatewayIds = (gateways ?? []).map(g => g.id);

  const { data: sensors } = gatewayIds.length > 0
    ? await admin.from('sensors').select('id, name, status, battery_level').in('gateway_id', gatewayIds)
    : { data: [] as { id: string; name: string; status: string; battery_level: number | null }[] };

  const sensorIds = (sensors ?? []).map(s => s.id);

  const { data: alertConfigs } = sensorIds.length > 0
    ? await admin.from('alert_configs').select('id, sensor_id, type, threshold').in('sensor_id', sensorIds)
    : { data: [] as { id: string; sensor_id: string; type: string; threshold: number }[] };

  return (
    <CustomerDetailClient
      customer={customer}
      gateways={gateways ?? []}
      sensors={sensors ?? []}
      alertConfigs={alertConfigs ?? []}
    />
  );
}
