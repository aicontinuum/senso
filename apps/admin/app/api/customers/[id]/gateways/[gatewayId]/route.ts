import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { requireUuid } from '@/lib/billing/validate';
import { findCustomerBranch } from '@/lib/branches/load';

type Params = { params: Promise<{ id: string; gatewayId: string }> };

const NOT_FOUND = NextResponse.json({ error: 'Gateway not found' }, { status: 404 });

/** Retire a gateway and its sensors.
 *
 *  These are soft deletes: hard-deleting sensors would cascade away every
 *  reading they ever recorded, for a whole gateway at once, destroying the
 *  compliance history. Stamping decommissioned_at removes them from every
 *  dashboard while keeping the readings attributable to a named sensor. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, gatewayId: rawGatewayId } = await params;
    const customerId = requireUuid(id, 'customer');
    const gatewayId = requireUuid(rawGatewayId, 'gateway');

    const { data: gateway, error: readError } = await ctx.admin
      .from('gateways').select('id').eq('id', gatewayId).eq('customer_id', customerId).maybeSingle();
    if (readError) throw new Error(`${readError.code} ${readError.message}`);
    if (!gateway) return NOT_FOUND;

    const now = new Date().toISOString();
    const { error: sensorsError } = await ctx.admin
      .from('sensors').update({ decommissioned_at: now }).eq('gateway_id', gatewayId);
    if (sensorsError) throw new Error(`${sensorsError.code} ${sensorsError.message}`);

    const { error } = await ctx.admin
      .from('gateways').update({ decommissioned_at: now }).eq('id', gatewayId);
    if (error) throw new Error(`${error.code} ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('retire gateway', error);
  }
}

/** Move a live gateway to another of the customer's branches. The database
 *  refuses a branch of another customer; the lookup here says so in words. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, gatewayId } = await params;
    const customerId = requireUuid(id, 'customer');
    const body = await readJson(request);
    const branch = await findCustomerBranch(ctx.admin, customerId, requireUuid(body.branchId, 'branch'));
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const { data, error } = await ctx.admin
      .from('gateways')
      .update({ branch_id: branch.id })
      .eq('id', requireUuid(gatewayId, 'gateway'))
      .eq('customer_id', customerId)
      .is('decommissioned_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    if (!data) return NOT_FOUND;

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('move gateway', error);
  }
}
