import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
// Shared with /api/ingest and /api/heartbeat — accepts the 16-hex LoRaWAN
// Gateway EUI as the primary format, with the legacy colon-MAC as a fallback.
// This route previously carried its own MAC-only copy of this logic, which is why
// it rejected the EUIs that ingest was already accepting.
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: customerId } = await params;
  const { macAddress, name } = await request.json();

  if (!macAddress || typeof macAddress !== 'string') {
    return NextResponse.json({ error: 'Gateway EUI is required' }, { status: 400 });
  }

  const normalised = normaliseIdentifier(macAddress);

  if (!isValidGatewayId(normalised)) {
    return NextResponse.json(
      { error: 'Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify customer exists
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const { data: gateway, error: insertError } = await admin
    .from('gateways')
    .insert({
      customer_id: customerId,
      mac_address: normalised,
      name: name?.trim() || null,
      is_online: false,
    })
    .select('id, name, is_online, firmware_version, last_seen_at, mac_address')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'This Gateway EUI is already registered to another gateway' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ gateway }, { status: 201 });
}
