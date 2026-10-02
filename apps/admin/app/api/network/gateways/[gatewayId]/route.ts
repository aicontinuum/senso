import { NextResponse } from 'next/server';
import { BillingRuleError, failureResponse, isDenied, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError } from '@/lib/billing/validate';
import { isValidGatewayId, normaliseIdentifier } from '@/lib/gateway-id';
import { removeGateway } from '@/lib/network/registry';
import { gatewayLink, requireRegistry, stillLinkedMessage, unwrap } from '@/lib/network/route';

/** Remove a gateway from the network server. Refused while a customer has
 *  it: unlinking is the customer page's job, and it never reaches here. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ gatewayId: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const registry = requireRegistry();
    const gatewayId = normaliseIdentifier((await params).gatewayId);
    if (!isValidGatewayId(gatewayId)) throw new BillingInputError('Gateway EUI is invalid');

    const link = await gatewayLink(ctx.admin, gatewayId);
    if (link) throw new BillingRuleError(stillLinkedMessage('gateway', link));

    unwrap(await removeGateway(registry, gatewayId), { missing: 'This gateway is not on the network server' });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('remove gateway', error);
  }
}
