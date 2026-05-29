import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/supabase/get-customer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const { alertRecipients } = await request.json();
  if (!Array.isArray(alertRecipients)) {
    return NextResponse.json({ error: 'Invalid recipients' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('customers')
    .update({ alert_recipients: alertRecipients })
    .eq('id', customer.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
