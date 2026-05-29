import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sensorId } = await params;

  // Use service role for ownership check to avoid RLS join issues
  const admin = createAdminClient();
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customer.id) {
    return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
  }

  const { name, minTemp, maxTemp, emailRecipients } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Sensor name is required' }, { status: 400 });
  if (minTemp == null || maxTemp == null) return NextResponse.json({ error: 'Thresholds are required' }, { status: 400 });
  if (Number(minTemp) >= Number(maxTemp)) return NextResponse.json({ error: 'Min must be less than max' }, { status: 400 });

  const { error: sensorError } = await admin.from('sensors').update({ name: name.trim() }).eq('id', sensorId);
  if (sensorError) return NextResponse.json({ error: sensorError.message }, { status: 400 });

  const recipients = Array.isArray(emailRecipients) ? emailRecipients : [];
  const thresholds = [
    { type: 'min', threshold: Number(minTemp) },
    { type: 'max', threshold: Number(maxTemp) },
  ];

  for (const row of thresholds) {
    const { data: existing } = await admin.from('alert_configs').select('id').eq('sensor_id', sensorId).eq('type', row.type).single();
    if (existing) {
      await admin.from('alert_configs').update({ threshold: row.threshold, email_recipients: recipients }).eq('id', existing.id);
    } else {
      const { error: insertError } = await admin.from('alert_configs').insert({
        sensor_id: sensorId,
        type: row.type,
        threshold: row.threshold,
        email_recipients: recipients,
      });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
