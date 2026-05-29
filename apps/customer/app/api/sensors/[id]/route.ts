import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sensorId } = await params;

  const supabase = await createClient();
  const { data: sensor } = await supabase
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

  const admin = createAdminClient();

  const { error: sensorError } = await admin.from('sensors').update({ name: name.trim() }).eq('id', sensorId);
  if (sensorError) return NextResponse.json({ error: sensorError.message }, { status: 400 });

  const recipients = Array.isArray(emailRecipients) ? emailRecipients : [];
  const upserts = [
    { sensor_id: sensorId, type: 'min', threshold: Number(minTemp), email_recipients: recipients },
    { sensor_id: sensorId, type: 'max', threshold: Number(maxTemp), email_recipients: recipients },
  ];

  for (const row of upserts) {
    const { data: existing } = await admin.from('alert_configs').select('id').eq('sensor_id', sensorId).eq('type', row.type).single();
    if (existing) {
      await admin.from('alert_configs').update({ threshold: row.threshold, email_recipients: row.email_recipients }).eq('id', existing.id);
    } else {
      await admin.from('alert_configs').insert(row);
    }
  }

  return NextResponse.json({ success: true });
}
