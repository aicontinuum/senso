import { NextResponse } from 'next/server';
import { validateThresholds } from '@senso/thresholds';
import { failureResponse, isDenied, readJson, requireAdmin, type AdminContext } from '@/lib/billing/route-helpers';
import { BillingInputError, MAX_LABEL, optionalUuid, requireText, requireUuid } from '@/lib/billing/validate';

type Params = { params: Promise<{ id: string; sensorId: string }> };

const NOT_FOUND = NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

/** The customer's live sensor, or null. Retired sensors are not editable
 *  or re-retirable: they resolve as not found. */
async function findCustomerSensor(admin: AdminContext['admin'], customerId: string, sensorId: string) {
  const { data, error } = await admin
    .from('sensors')
    .select('id, gateway_id, gateways!inner (customer_id)')
    .eq('id', sensorId)
    .is('decommissioned_at', null)
    .maybeSingle();
  if (error) throw new Error(`${error.code} ${error.message}`);
  if (!data || (data.gateways as unknown as { customer_id: string }).customer_id !== customerId) return null;
  return data;
}

/** Rename a sensor, move it to another of the customer's gateways, and
 *  set both temperature limits. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, sensorId: rawSensorId } = await params;
    const customerId = requireUuid(id, 'customer');
    const sensorId = requireUuid(rawSensorId, 'sensor');
    const body = await readJson(request);
    const name = requireText(body.name, 'Sensor name', MAX_LABEL);
    const gatewayId = optionalUuid(body.gatewayId, 'gateway');
    const limits = validateThresholds(body.minTemp, body.maxTemp);
    if (!limits.ok) throw new BillingInputError(limits.error);

    const sensor = await findCustomerSensor(ctx.admin, customerId, sensorId);
    if (!sensor) return NOT_FOUND;

    if (gatewayId !== null && gatewayId !== sensor.gateway_id) {
      const { data: gateway, error } = await ctx.admin
        .from('gateways').select('id').eq('id', gatewayId).eq('customer_id', customerId).maybeSingle();
      if (error) throw new Error(`${error.code} ${error.message}`);
      if (!gateway) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
    }

    const { error: sensorError } = await ctx.admin
      .from('sensors')
      .update({ name, gateway_id: gatewayId ?? sensor.gateway_id })
      .eq('id', sensorId);
    if (sensorError) throw new Error(`${sensorError.code} ${sensorError.message}`);

    // One config per limit. Recipients are account-wide and live on
    // `customers.alert_recipients`, edited on the customer page.
    for (const row of [{ type: 'min', threshold: limits.min }, { type: 'max', threshold: limits.max }]) {
      const { data: existing, error: readError } = await ctx.admin
        .from('alert_configs').select('id').eq('sensor_id', sensorId).eq('type', row.type).maybeSingle();
      if (readError) throw new Error(`${readError.code} ${readError.message}`);
      const { error } = existing
        ? await ctx.admin.from('alert_configs').update({ threshold: row.threshold }).eq('id', existing.id)
        : await ctx.admin.from('alert_configs').insert({ sensor_id: sensorId, type: row.type, threshold: row.threshold });
      if (error) throw new Error(`${error.code} ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('update sensor', error);
  }
}

/** Retire a sensor. A hard delete would take its entire reading history
 *  with it, which is the compliance record we exist to keep; stamping
 *  decommissioned_at retires it from every dashboard while leaving its
 *  readings attributable. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await requireAdmin();
  if (isDenied(ctx)) return ctx.response;
  try {
    const { id, sensorId: rawSensorId } = await params;
    const customerId = requireUuid(id, 'customer');
    const sensorId = requireUuid(rawSensorId, 'sensor');
    if (!(await findCustomerSensor(ctx.admin, customerId, sensorId))) return NOT_FOUND;

    const { error } = await ctx.admin
      .from('sensors').update({ decommissioned_at: new Date().toISOString() }).eq('id', sensorId);
    if (error) throw new Error(`${error.code} ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return failureResponse('retire sensor', error);
  }
}
