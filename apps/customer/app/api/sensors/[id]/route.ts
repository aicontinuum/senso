import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import {
  validateSensorName,
  normaliseSensorName,
  SENSOR_NAME_MESSAGES,
} from '@/lib/sensor-name';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const { name, minTemp, maxTemp, emailRecipients } = await request.json();

  if (minTemp == null || maxTemp == null) return NextResponse.json({ error: 'Thresholds are required' }, { status: 400 });
  if (Number(minTemp) >= Number(maxTemp)) return NextResponse.json({ error: 'Min must be less than max' }, { status: 400 });

  // The name is optional in the payload so older clients keep working, but if it
  // is present it is validated here rather than trusted from the browser.
  if (name !== undefined) {
    const nameError = validateSensorName(name);
    if (nameError) {
      return NextResponse.json({ error: SENSOR_NAME_MESSAGES[nameError] }, { status: 400 });
    }

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

  const recipients = Array.isArray(emailRecipients) ? emailRecipients : [];
  const thresholds = [
    { type: 'min', threshold: Number(minTemp) },
    { type: 'max', threshold: Number(maxTemp) },
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
        .update({ threshold: row.threshold, email_recipients: recipients })
        .eq('id', existing.id);
      if (error) {
        console.error('Threshold update failed', { sensorId, type: row.type, error });
        return NextResponse.json({ error: 'Could not save the thresholds.' }, { status: 400 });
      }
    } else {
      const { error } = await supabase
        .from('alert_configs')
        .insert({ sensor_id: sensorId, type: row.type, threshold: row.threshold, email_recipients: recipients });
      if (error) {
        console.error('Threshold insert failed', { sensorId, type: row.type, error });
        return NextResponse.json({ error: 'Could not save the thresholds.' }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
