import { NextResponse } from 'next/server';
import { failureResponse, isDenied, NetworkServerError, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError } from '@/lib/billing/validate';
import { isValidDevEui, normaliseDevEui } from '@/lib/deveui';
import { queueReportingInterval } from '@/lib/network/registry';
import { requireRegistry } from '@/lib/network/route';

/** Queue the reporting-interval command again, for a sensor that was reset
 *  or replaced. It takes effect after the sensor's next uplink. */
export async function POST(_request: Request, { params }: { params: Promise<{ devEui: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const registry = requireRegistry();
    const devEui = normaliseDevEui((await params).devEui);
    if (!isValidDevEui(devEui)) throw new BillingInputError('DevEUI is invalid');

    const result = await queueReportingInterval(registry, devEui);
    if (!result.ok) throw new NetworkServerError(result.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('resend interval', error);
  }
}
