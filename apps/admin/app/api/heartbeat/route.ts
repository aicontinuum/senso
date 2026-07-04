import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';

// Lightweight liveness pulse from a gateway — no readings, just "I'm alive and
// connected." Stamps last_seen_at so the platform can detect a silent gateway
// quickly and independently of the temperature reading cadence.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { mac_address?: string };
  if (!body.mac_address) return NextResponse.json({ error: 'mac_address is required' }, { status: 400 });

  const identifier = normaliseIdentifier(body.mac_address);
  if (!isValidGatewayId(identifier)) {
    return NextResponse.json({ error: 'Invalid gateway identifier' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: gateway } = await admin
    .from('gateways')
    .select('id')
    .eq('mac_address', identifier)
    .single();

  if (!gateway) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });

  await admin
    .from('gateways')
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq('id', gateway.id);

  return NextResponse.json({ ok: true });
}
