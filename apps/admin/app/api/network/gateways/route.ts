import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, requireText } from '@/lib/billing/validate';
import { isValidGatewayId, normaliseIdentifier } from '@/lib/gateway-id';
import { registerGateway } from '@/lib/network/registry';
import { networkName } from '@/lib/network/naming';
import { requireRegistry, unwrap } from '@/lib/network/route';

/** Register a gateway on the network server. Linking it to a customer is a
 *  separate step on the customer's page. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const registry = requireRegistry();
    const body = await readJson(request);
    const gatewayId = normaliseIdentifier(requireText(body.eui, 'Gateway EUI', MAX_LABEL));
    if (!isValidGatewayId(gatewayId)) {
      throw new BillingInputError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
    }
    const name = networkName('gateway', gatewayId);

    unwrap(await registerGateway(registry, gatewayId, name), { exists: 'A gateway with this EUI is already registered' });
    return NextResponse.json({ gatewayId, name }, { status: 201 });
  } catch (error) {
    return failureResponse('register gateway', error);
  }
}
