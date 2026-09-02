import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Commissioning marks the moment a sensor was installed at the site and entered
// the customer's compliance record. Before it, readings are stored but raise no
// alerts and appear in no report — see
// supabase/migrations/20260902_sensor_commissioning.sql.
//
// Reversible, because a technician can commission the wrong sensor and leaving
// them stuck with a wrong record is worse than allowing a correction. But
// un-commissioning removes readings from a report, so it is never a silent
// clear: it demands a reason, and both directions are written to
// sensor_commissioning_events with the admin who acted.

const MAX_REASON_LENGTH = 300;

type Action = 'commission' | 'uncommission';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sensorId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action, reason } = (body ?? {}) as { action?: string; reason?: unknown };
  // Allowlist, not a blocklist: anything that is not one of these two is refused.
  if (action !== 'commission' && action !== 'uncommission') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  const verb = action as Action;

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (verb === 'uncommission') {
    if (!trimmedReason) {
      return NextResponse.json(
        { error: 'A reason is required — un-commissioning removes readings from the customer’s report.' },
        { status: 400 },
      );
    }
    if (trimmedReason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be ${MAX_REASON_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }
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

  const alreadyInService = sensor.commissioned_at !== null;
  if (verb === 'commission' && alreadyInService) {
    return NextResponse.json({ error: 'Sensor is already in service' }, { status: 409 });
  }
  if (verb === 'uncommission' && !alreadyInService) {
    return NextResponse.json({ error: 'Sensor is not in service' }, { status: 409 });
  }

  const commissionedAt = verb === 'commission' ? new Date().toISOString() : null;

  const { error: updateError } = await admin
    .from('sensors')
    .update({ commissioned_at: commissionedAt })
    .eq('id', sensorId);

  if (updateError) {
    console.error('[commission] update failed', { sensorId, verb, error: updateError });
    return NextResponse.json({ error: 'Could not update the sensor.' }, { status: 400 });
  }

  // Written after the update, so the log never claims a change that did not
  // happen. A failure here leaves the change made but unlogged, which is loud in
  // the server log and recoverable — the reverse order would be neither.
  const { error: auditError } = await admin.from('sensor_commissioning_events').insert({
    sensor_id: sensorId,
    action: verb === 'commission' ? 'commissioned' : 'uncommissioned',
    commissioned_at: commissionedAt,
    actor_id: user.id,
    reason: trimmedReason || null,
  });

  if (auditError) {
    console.error('[commission] audit write failed', { sensorId, verb, error: auditError });
  }

  return NextResponse.json({ success: true, commissionedAt });
}
