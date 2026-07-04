import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';
import { gatewaySecretOk } from '@/lib/gateway-auth';

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

  const { data: sec } = await admin.from('gateways').select('secret').eq('id', gateway.id).single();
  if (!gatewaySecretOk(request, (sec?.secret as string | null) ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await admin
    .from('gateways')
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq('id', gateway.id);

  return NextResponse.json({ ok: true });
}
