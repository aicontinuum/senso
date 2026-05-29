import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const { name, contactName, email, phone } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
  }
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const { id: customerId } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from('customers')
    .update({
      name: name.trim(),
      contact_name: contactName?.trim() || null,
      email: email.trim(),
      phone: phone?.trim() || null,
    })
    .eq('id', customerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
