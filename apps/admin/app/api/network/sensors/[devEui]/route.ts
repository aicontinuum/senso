import { NextResponse } from 'next/server';
import { BillingRuleError, failureResponse, isDenied, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError } from '@/lib/billing/validate';
import { isValidDevEui, normaliseDevEui } from '@/lib/deveui';
import { removeSensor } from '@/lib/network/registry';
import { requireRegistry, sensorLink, stillLinkedMessage, unwrap } from '@/lib/network/route';

/** Remove a sensor from the network server. Refused while a customer has
 *  it: unlinking is the customer page's job, and it never reaches here. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ devEui: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const registry = requireRegistry();
    const devEui = normaliseDevEui((await params).devEui);
    if (!isValidDevEui(devEui)) throw new BillingInputError('DevEUI is invalid');

    const link = await sensorLink(ctx.admin, devEui);
    if (link) throw new BillingRuleError(stillLinkedMessage('sensor', link));

    unwrap(await removeSensor(registry, devEui), { missing: 'This sensor is not on the network server' });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('remove sensor', error);
  }
}
