import { NextResponse } from 'next/server';
import { requireActiveCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import {
  validateSensorName,
  normaliseSensorName,
  SENSOR_NAME_MESSAGES,
} from '@/lib/sensor-name';
import { validateThresholds } from '@/lib/thresholds';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireActiveCustomer();
  if ('response' in gate) return gate.response;
  const { customer } = gate;

  const { id: sensorId } = await params;
  const supabase = await createClient();

  // Verify sensor belongs to this customer via two separate queries (avoids join RLS issues)
  const { data: sensorRow } = await supabase
    .from('sensors')
    .select('id, gateway_id')
    .eq('id', sensorId)
    .is('decommissioned_at', null)
    .single();

  if (!sensorRow) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  const { data: gateway } = await supabase
    .from('gateways')
    .select('id')
    .eq('id', sensorRow.gateway_id)
    .eq('customer_id', customer.id)
    .single();

  if (!gateway) return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });

  let body: { name?: unknown; minTemp?: unknown; maxTemp?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  const { name, minTemp, maxTemp } = body;

  // Everything is checked before anything is written, so a bad request
  // never half-applies (a rename that went through while the limits were
  // refused). A limit must be a real number: Number('abc') is NaN, which
  // passes a comparison and would be stored as no limit at all.
  const limits = validateThresholds(minTemp, maxTemp);
  if (!limits.ok) return NextResponse.json({ error: limits.error }, { status: 400 });
  if (name !== undefined) {
    const nameError = validateSensorName(name);
    if (nameError) {
      return NextResponse.json({ error: SENSOR_NAME_MESSAGES[nameError] }, { status: 400 });
    }
  }

  // The name is optional in the payload so older clients keep working.
  if (name !== undefined) {

    const { data: renamed, error: renameError } = await supabase
      .from('sensors')
      .update({ name: normaliseSensorName(name as string) })
      .eq('id', sensorId)
      .is('decommissioned_at', null)
      .select('id');

    if (renameError) {
      console.error('Sensor rename failed', { sensorId, error: renameError });
      return NextResponse.json({ error: 'Could not save the sensor name.' }, { status: 400 });
    }

    // Row-level security filters rather than errors, so a policy that does not
    // permit this update comes back as zero rows and would otherwise look like a
    // silent success.
    if (!renamed || renamed.length === 0) {
      console.error('Sensor rename affected no rows', { sensorId, customerId: customer.id });
      return NextResponse.json({ error: 'Could not save the sensor name.' }, { status: 403 });
    }
  }

  // Recipients are account-wide and live on `customers.alert_recipients`, edited
  // in Settings (customer) or on the customer page (admin). The per-sensor list
  // that used to be written here is gone: the two were unioned, so it could only
  // ever add people rather than route to them, and one email covers every alert
  // open for a customer — anyone added to one sensor received the others anyway.
  const thresholds = [
    { type: 'min', threshold: limits.min },
    { type: 'max', threshold: limits.max },
  ];

  for (const row of thresholds) {
    const { data: existing } = await supabase
      .from('alert_configs')
      .select('id')
      .eq('sensor_id', sensorId)
      .eq('type', row.type)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('alert_configs')
        .update({ threshold: row.threshold })
        .eq('id', existing.id);
      if (error) {
        console.error('Threshold update failed', { sensorId, type: row.type, error });
        return NextResponse.json({ error: 'Could not save the thresholds.' }, { status: 400 });
      }
    } else {
      const { error } = await supabase
        .from('alert_configs')
        .insert({ sensor_id: sensorId, type: row.type, threshold: row.threshold });
      if (error) {
        console.error('Threshold insert failed', { sensorId, type: row.type, error });
        return NextResponse.json({ error: 'Could not save the thresholds.' }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
