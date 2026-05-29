import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
  const admin = createAdminClient();

  // Verify the sensor belongs to this customer via its gateway
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, gateway_id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customerId) {
    return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
  }

  const { error } = await admin.from('sensors').delete().eq('id', sensorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
