import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Marks a sensor as installed: the moment its readings enter the customer's
// compliance record. Before it, ingest stores readings but opens no alerts and
// reports exclude them entirely — see
// supabase/migrations/20260902_sensor_commissioning.sql.
//
// Commission only. There is no un-commission endpoint by design: withdrawing a
// sensor that really was in service is Unlink (which keeps its history in
// reports, tagged "Retired"), and withdrawing one that was commissioned by
// mistake removes readings from a report the customer may already hold. That
// second case is a correction, not a lifecycle step — rare, and better done
// deliberately from the office than by a click in the field. When it is done,
// record it in sensor_commissioning_events with a reason, which is why that
// table still accepts an 'uncommissioned' action.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sensorId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: customerId, sensorId } = await params;
  const admin = createAdminClient();

  const { data: sensor } = await admin
    .from('sensors')
    .select('id, commissioned_at, gateways!inner (customer_id)')
    .eq('id', sensorId)
    // A retired sensor's commissioning is part of a closed record and is not
    // editable, the same way its name and thresholds are not.
    .is('decommissioned_at', null)
    .single();

  if (!sensor || (sensor.gateways as unknown as { customer_id: string }).customer_id !== customerId) {
    return NextResponse.json({ error: 'Sensor not found' }, { status: 404 });
  }

  // Not an error worth surfacing as a failure, but not a silent success either:
  // two technicians on the same sensor should not quietly move its start time.
  if (sensor.commissioned_at !== null) {
    return NextResponse.json({ error: 'Sensor is already in service' }, { status: 409 });
  }

  const commissionedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from('sensors')
    .update({ commissioned_at: commissionedAt })
    .eq('id', sensorId);

  if (updateError) {
    console.error('[commission] update failed', { sensorId, error: updateError });
    return NextResponse.json({ error: 'Could not update the sensor.' }, { status: 400 });
  }

  // Written after the update, so the log never claims a change that did not
  // happen. A failure here leaves the sensor commissioned but unlogged, which is
  // loud in the server log and recoverable — the reverse order would be neither.
  const { error: auditError } = await admin.from('sensor_commissioning_events').insert({
    sensor_id: sensorId,
    action: 'commissioned',
    commissioned_at: commissionedAt,
    actor_id: user.id,
  });

  if (auditError) {
    console.error('[commission] audit write failed', { sensorId, error: auditError });
  }

  return NextResponse.json({ success: true, commissionedAt });
}
