import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';

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

  const { alertRecipients, contactName, phone } = await request.json();

  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (Array.isArray(alertRecipients)) update.alert_recipients = alertRecipients;
  if (contactName !== undefined) update.contact_name = contactName?.trim() || null;
  if (phone !== undefined) update.phone = phone?.trim() || null;

  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabase
    .from('customers')
    .update(update)
    .eq('id', customer.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
