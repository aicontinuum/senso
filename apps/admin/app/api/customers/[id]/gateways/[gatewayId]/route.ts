import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; gatewayId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: customerId, gatewayId } = await params;
  const admin = createAdminClient();

  // Verify the gateway belongs to this customer before deleting
  const { data: gateway } = await admin
    .from('gateways')
    .select('id')
    .eq('id', gatewayId)
    .eq('customer_id', customerId)
    .single();

  if (!gateway) {
    return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
  }

  // Delete all sensors on this gateway first, then the gateway itself
  const { error: sensorsError } = await admin.from('sensors').delete().eq('gateway_id', gatewayId);

  if (sensorsError) {
    return NextResponse.json({ error: sensorsError.message }, { status: 400 });
  }

  const { error } = await admin.from('gateways').delete().eq('id', gatewayId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
