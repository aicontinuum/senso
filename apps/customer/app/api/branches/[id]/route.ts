import { NextResponse } from 'next/server';
import { requireActiveCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import { validateRecipients, RECIPIENTS_MESSAGES } from '@senso/recipients';

// The one thing a customer may change on a branch: who is emailed about its
// alerts. The update runs as the signed-in user, so row-level security and
// the column grant decide what it may touch; a branch of another customer
// is invisible and the update reaches no row.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireActiveCustomer();
  if ('response' in gate) return gate.response;
  const { customer } = gate;

  const { id } = await params;
  const { alertRecipients } = await request.json();
  const result = validateRecipients(alertRecipients);
  if (!result.ok) {
    return NextResponse.json({ error: RECIPIENTS_MESSAGES[result.error] }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branches')
    .update({ alert_recipients: result.value })
    .eq('id', id)
    .eq('customer_id', customer.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Branch recipients update failed', { customerId: customer.id, code: error.code, message: error.message });
    return NextResponse.json({ error: 'Could not save your changes. Please try again.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
