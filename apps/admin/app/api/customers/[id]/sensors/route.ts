import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normaliseDevEui, isValidDevEui } from '@/lib/deveui';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { gatewayId, name, hardwareId } = await request.json();

  if (!gatewayId || !name?.trim()) {
    return NextResponse.json({ error: 'Gateway and name are required' }, { status: 400 });
  }
  if (!hardwareId?.trim()) {
    return NextResponse.json({ error: 'DevEUI is required' }, { status: 400 });
  }
  const devEui = normaliseDevEui(hardwareId);
  if (!isValidDevEui(devEui)) {
    return NextResponse.json(
      { error: 'Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c' },
      { status: 400 },
    );
  }

  const { id: customerId } = await params;
  const admin = createAdminClient();

  // Verify the gateway belongs to this customer
  const { data: gateway } = await admin
    .from('gateways')
    .select('id')
    .eq('id', gatewayId)
    .eq('customer_id', customerId)
    .is('decommissioned_at', null)
    .single();

  if (!gateway) {
    return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
  }

  const { data: sensor, error: insertError } = await admin
    .from('sensors')
    .insert({
      gateway_id: gatewayId,
      name: name.trim(),
      hardware_id: devEui,
      status: 'offline',
    })
    .select('id, name, status, battery_level')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'This hardware ID is already registered to another sensor' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ sensor }, { status: 201 });
}
