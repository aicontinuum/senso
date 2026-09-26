import { NextResponse } from 'next/server';
import { failureResponse, isDenied, readJson, requireAdmin } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, requireText, requireUuid } from '@/lib/billing/validate';
import { normaliseDevEui, isValidDevEui } from '@/lib/deveui';

/** The partial unique index counts live rows only, so a clash means the
 *  device is registered *and in service* somewhere else right now. */
const DUPLICATE_CODE = '23505';

/** Add a sensor to one of the customer's live gateways. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const customerId = requireUuid((await params).id, 'customer');
    const body = await readJson(request);
    const gatewayId = requireUuid(body.gatewayId, 'gateway');
    const name = requireText(body.name, 'Sensor name', MAX_LABEL);
    const devEui = normaliseDevEui(requireText(body.hardwareId, 'DevEUI', MAX_LABEL));
    if (!isValidDevEui(devEui)) {
      throw new BillingInputError('Invalid DevEUI — expected 16 hex characters, e.g. a840419edb62011c');
    }

    const { data: gateway, error: gatewayError } = await ctx.admin
      .from('gateways')
      .select('id')
      .eq('id', gatewayId)
      .eq('customer_id', customerId)
      .is('decommissioned_at', null)
      .maybeSingle();
    if (gatewayError) throw new Error(`${gatewayError.code} ${gatewayError.message}`);
    if (!gateway) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });

    // `commissioned_at` is deliberately left unset: a newly linked sensor is not
    // in service until a technician marks it installed at the site. Giving it a
    // default here would put every bench reading straight into the customer's
    // compliance record, which is the whole thing commissioning exists to stop.
    const { data: sensor, error: insertError } = await ctx.admin
      .from('sensors')
      .insert({ gateway_id: gatewayId, name, hardware_id: devEui, status: 'offline' })
      .select('id, name, status, battery_level')
      .single();
    if (insertError?.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'This DevEUI is already registered to an active sensor. If you are moving the device, remove it from its current customer first.' },
        { status: 409 },
      );
    }
    if (insertError) throw new Error(`${insertError.code} ${insertError.message}`);

    return NextResponse.json({ sensor }, { status: 201 });
  } catch (error) {
    return failureResponse('add sensor', error);
  }
}
