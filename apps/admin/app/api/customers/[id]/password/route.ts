import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { password } = await request.json();

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 },
    );
  }

  const { id: customerId } = await params;
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from('customers')
    .select('auth_user_id')
    .eq('id', customerId)
    .single();

  if (!customer?.auth_user_id) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(customer.auth_user_id, {
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
