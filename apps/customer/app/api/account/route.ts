import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import { isValidTimezone } from '@/lib/timezones';
import { validateRecipients, RECIPIENTS_MESSAGES } from '@/lib/recipients';

export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('alert_recipients')
    .eq('id', customer.id)
    .single();

  return NextResponse.json({ alertRecipients: (data?.alert_recipients as string[]) ?? [] });
}

export async function PATCH(request: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { alertRecipients, contactName, phone, timezone } = await request.json();

  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (alertRecipients !== undefined) {
    // These addresses are what the alerting system sends to, so the list is
    // checked here and the normalised result is what gets stored — never the
    // raw input.
    const result = validateRecipients(alertRecipients);
    if (!result.ok) {
      return NextResponse.json({ error: RECIPIENTS_MESSAGES[result.error] }, { status: 400 });
    }
    update.alert_recipients = result.value;
  }
  if (contactName !== undefined) update.contact_name = contactName?.trim() || null;
  if (phone !== undefined) update.phone = phone?.trim() || null;
  if (timezone !== undefined) {
    if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }
    update.timezone = timezone;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabase
    .from('customers')
    .update(update)
    .eq('id', customer.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
