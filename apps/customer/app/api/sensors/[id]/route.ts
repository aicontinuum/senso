import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sensorId } = await params;
  const supabase = await createClient();

  // Verify sensor belongs to this customer via two separate queries (avoids join RLS issues)
  const { data: sensorRow } = await supabase
    .from('sensors')
    .select('id, gateway_id')
    .eq('id', sensorId)
    .single();

  if (!sensorRow) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const { data: gateway } = await supabase
    .from('gateways')
    .select('id')
    .eq('id', sensorRow.gateway_id)
    .eq('customer_id', customer.id)
    .single();

  if (!gateway) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const { minTemp, maxTemp, emailRecipients } = await request.json();

  if (minTemp == null || maxTemp == null) return NextResponse.json({ error: 'Thresholds are required' }, { status: 400 });
  if (Number(minTemp) >= Number(maxTemp)) return NextResponse.json({ error: 'Min must be less than max' }, { status: 400 });

  const recipients = Array.isArray(emailRecipients) ? emailRecipients : [];
  const thresholds = [
    { type: 'min', threshold: Number(minTemp) },
    { type: 'max', threshold: Number(maxTemp) },
  ];

  for (const row of thresholds) {
    const { data: existing } = await supabase
      .from('alert_configs')
      .select('id')
      .eq('sensor_id', sensorId)
      .eq('type', row.type)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('alert_configs')
        .update({ threshold: row.threshold, email_recipients: recipients })
        .eq('id', existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase
        .from('alert_configs')
        .insert({ sensor_id: sensorId, type: row.type, threshold: row.threshold, email_recipients: recipients });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
