import { NextResponse } from 'next/server';
import { requireActiveCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';

// Remove a retired sensor from the customer's Reports page. Hidden, not
// deleted: the sensor and its readings stay, and the admin site still
// sees them. Only a retired sensor can be hidden; the database refuses
// the rest as well (20261003_sensor_hidden.sql).

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireActiveCustomer();
  if ('response' in gate) return gate.response;
  const { customer } = gate;

  const { id: sensorId } = await params;
  const supabase = await createClient();

  // Ownership in two reads, as the sensor route does: the row rules scope
  // each table to the signed-in customer, and a group's owner login can
  // read a member's sensor but holds no update on it.
  const { data: sensor, error: readError } = await supabase
    .from('sensors')
    .select('id, gateway_id, decommissioned_at, hidden_at')
    .eq('id', sensorId)
    .maybeSingle();
  if (readError) {
    console.error('[hide sensor] read failed', { sensorId, code: readError.code, message: readError.message });
    return NextResponse.json({ error: 'Could not remove the sensor. Please try again.' }, { status: 500 });
  }
  if (!sensor) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const { data: gateway } = await supabase
    .from('gateways').select('id').eq('id', sensor.gateway_id).eq('customer_id', customer.id).maybeSingle();
  if (!gateway) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  if (sensor.decommissioned_at === null) {
    return NextResponse.json({ error: 'Only a retired sensor can be removed from reports' }, { status: 409 });
  }
  if (sensor.hidden_at !== null) return NextResponse.json({ success: true });

  const { error } = await supabase.from('sensors').update({ hidden_at: new Date().toISOString() }).eq('id', sensorId);
  if (error) {
    console.error('[hide sensor] update failed', { sensorId, code: error.code, message: error.message });
    return NextResponse.json({ error: 'Could not remove the sensor. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
