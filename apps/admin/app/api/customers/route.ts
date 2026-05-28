import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  // Verify the requester is a logged-in admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, contactName, contactEmail, phone, password } = await request.json();

  const admin = createAdminClient();

  // Create the Supabase auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: contactEmail,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Insert the customer record linked to the new auth user
  const { error: dbError } = await admin
    .from('customers')
    .insert({
      name,
      contact_name: contactName,
      email: contactEmail,
      phone: phone || null,
      auth_user_id: authData.user.id,
      status: 'active',
    });

  if (dbError) {
    // Roll back: delete the auth user so we don't leave orphaned accounts
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
