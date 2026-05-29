import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function normaliseMac(raw: string): string {
  const stripped = raw.replace(/[\s\-:]/g, '').toLowerCase();
  if (stripped.length === 12) {
    return stripped.match(/.{2}/g)!.join(':');
  }
  return raw.trim().toLowerCase();
}

const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;

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
    return NextResponse.json({ error: 'MAC address is required' }, { status: 400 });
  }

  const normalised = normaliseMac(macAddress);

  if (!MAC_RE.test(normalised)) {
    return NextResponse.json(
      { error: 'Invalid MAC address — use format AA:BB:CC:DD:EE:FF' },
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
        { error: 'This MAC address is already registered to another gateway' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ gateway }, { status: 201 });
}
