import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyOwnership(customerId: string, sensorId: string) {
  const admin = createAdminClient();
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, gateway_id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .single();
  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customerId) {
    return null;
  }
  return sensor;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sensorId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: customerId, sensorId } = await params;
  const sensor = await verifyOwnership(customerId, sensorId);
  if (!sensor) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const { name, gatewayId, minTemp, maxTemp } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Sensor name is required' }, { status: 400 });
  if (minTemp == null || maxTemp == null) return NextResponse.json({ error: 'Thresholds are required' }, { status: 400 });
  if (Number(minTemp) >= Number(maxTemp)) return NextResponse.json({ error: 'Min must be less than max' }, { status: 400 });

  const admin = createAdminClient();

  // Verify the new gateway belongs to this customer
  if (gatewayId && gatewayId !== sensor.gateway_id) {
    const { data: gw } = await admin.from('gateways').select('id').eq('id', gatewayId).eq('customer_id', customerId).single();
    if (!gw) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
  }

  const { error: sensorError } = await admin
    .from('sensors')
    .update({ name: name.trim(), gateway_id: gatewayId ?? sensor.gateway_id })
    .eq('id', sensorId);

  if (sensorError) return NextResponse.json({ error: sensorError.message }, { status: 400 });

  // Upsert below_min and above_max alert_configs
  const upserts = [
    { sensor_id: sensorId, type: 'below_min', threshold: Number(minTemp) },
    { sensor_id: sensorId, type: 'above_max', threshold: Number(maxTemp) },
  ];

  for (const row of upserts) {
    const { data: existing } = await admin.from('alert_configs').select('id').eq('sensor_id', sensorId).eq('type', row.type).single();
    if (existing) {
      await admin.from('alert_configs').update({ threshold: row.threshold }).eq('id', existing.id);
    } else {
      await admin.from('alert_configs').insert(row);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sensorId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: customerId, sensorId } = await params;
  const sensor = await verifyOwnership(customerId, sensorId);
  if (!sensor) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin.from('sensors').delete().eq('id', sensorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
