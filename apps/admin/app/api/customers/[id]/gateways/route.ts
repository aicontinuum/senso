import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, optionalText, optionalUuid, requireText, requireUuid } from '@/lib/billing/validate';
// Same identifier rules ingest matches on — accepts the 16-hex LoRaWAN
// Gateway EUI as the primary format, with the legacy colon-MAC as a fallback.
import { normaliseIdentifier, isValidGatewayId } from '@/lib/gateway-id';

/** The partial unique index counts live rows only, so a clash means the
 *  device is registered somewhere else right now. */
const DUPLICATE_CODE = '23505';

/** Link a gateway to a customer, at one of the customer's branches. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const identifier = normaliseIdentifier(requireText(body.macAddress, 'Gateway EUI', MAX_LABEL));
    if (!isValidGatewayId(identifier)) {
      throw new BillingInputError('Invalid Gateway EUI — expected 16 hex characters, e.g. 2cf7f11081400088');
    }
    const name = optionalText(body.name, 'name', MAX_LABEL);
    const branchId = optionalUuid(body.branchId, 'branch');

    const { data: customer, error: customerError } = await ctx.admin
      .from('customers').select('id').eq('id', customerId).maybeSingle();
    if (customerError) throw new Error(`${customerError.code} ${customerError.message}`);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Every gateway sits in a branch. A customer with one branch never has to
    // say which; with several, the caller must. The lookup is scoped to the
    // customer, so a branch id from another customer is simply not found.
    const { data: branches, error: branchesError } = await ctx.admin
      .from('branches').select('id').eq('customer_id', customerId);
    if (branchesError) throw new Error(`${branchesError.code} ${branchesError.message}`);
    const branch = branchId !== null
      ? branches.find(b => b.id === branchId)
      : branches.length === 1 ? branches[0] : undefined;
    if (!branch) return NextResponse.json({ error: 'Choose which branch this gateway is installed at' }, { status: 400 });

    const { data: gateway, error: insertError } = await ctx.admin
      .from('gateways')
      .insert({ customer_id: customerId, branch_id: branch.id, mac_address: identifier, name, is_online: false })
      .select('id, name, is_online, firmware_version, last_seen_at, mac_address')
      .single();
    if (insertError?.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'This Gateway EUI is already registered to an active gateway. If you are moving it, remove it from its current customer first.' },
        { status: 409 },
      );
    }
    if (insertError) throw new Error(`${insertError.code} ${insertError.message}`);

    return NextResponse.json({ gateway }, { status: 201 });
  } catch (error) {
    return failureResponse('link gateway', error);
  }
}
