import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RECIPIENTS_MESSAGES, validateRecipients } from '@senso/recipients';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, contactName, email, phone, alertRecipients } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
  }
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const { id: customerId } = await params;
  const admin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    name: name.trim(),
    contact_name: contactName?.trim() || null,
    email: email.trim(),
    phone: phone?.trim() || null,
  };
  // These addresses are what the alert job sends to, so the list is checked
  // with the same rules the customer app applies and the normalised result
  // is what gets stored. One bad entry used to abort a whole alert run.
  if (alertRecipients !== undefined) {
    const result = validateRecipients(alertRecipients);
    if (!result.ok) {
      return NextResponse.json({ error: RECIPIENTS_MESSAGES[result.error] }, { status: 400 });
    }
    updatePayload.alert_recipients = result.value;
  }

  const { error } = await admin
    .from('customers')
    .update(updatePayload)
    .eq('id', customerId);

  if (error) {
    console.error('Customer update failed', { customerId, code: error.code, message: error.message });
    return NextResponse.json({ error: 'Could not save the customer. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
