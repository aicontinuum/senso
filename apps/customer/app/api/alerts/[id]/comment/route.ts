import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import { ALERT_COMMENT_MAX_LENGTH } from '@/lib/constants';

// A supervisor's note explaining one alert.
//
// Writes go through the *user's* session client, not the service role, so row
// level security is the authority on whether this customer owns this alert —
// the same pattern the sensor rename uses. Ownership is never re-derived here.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: alertLogId } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { body } = (payload ?? {}) as { body?: unknown };
  if (typeof body !== 'string') {
    return NextResponse.json({ error: 'A comment is required.' }, { status: 400 });
  }

  const text = body.trim();
  if (text.length === 0) {
    return NextResponse.json({ error: 'A comment is required.' }, { status: 400 });
  }
  if (text.length > ALERT_COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be ${ALERT_COMMENT_MAX_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Upsert on the unique alert_log_id: "add" and "edit" are the same action from
  // the supervisor's point of view, and treating them as one removes the race
  // where two people both add a first comment.
  //
  // author_id, created_at and updated_at are all set by the database — the
  // column grants do not let a client touch them.
  const { data, error } = await supabase
    .from('alert_comments')
    .upsert({ alert_log_id: alertLogId, body: text }, { onConflict: 'alert_log_id' })
    .select('body, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('Alert comment save failed', { alertLogId, error });
    return NextResponse.json({ error: 'Could not save the comment.' }, { status: 400 });
  }

  // RLS filters rather than errors, so an alert this customer does not own comes
  // back as no row instead of a failure — which would otherwise look like a
  // silent success to the person typing.
  if (!data) {
    console.error('Alert comment affected no rows', { alertLogId, customerId: customer.id });
    return NextResponse.json({ error: 'Could not save the comment.' }, { status: 403 });
  }

  return NextResponse.json({
    body: data.body,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
