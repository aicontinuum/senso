import { redirect } from 'next/navigation';
import { createClient } from './server';
import { DEFAULT_TIMEZONE } from '@/lib/timezones';

export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  timezone: string;
  created_at: string;
};

export async function getCustomer(): Promise<CustomerRecord | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, contact_name, phone, timezone, created_at')
    .eq('auth_user_id', user.id)
    .single();
  if (!data) return null;
  return { ...data, timezone: data.timezone ?? DEFAULT_TIMEZONE };
}

// Like getCustomer(), but redirects to login (with an error param so the
// middleware won't bounce back into a loop) when no customer resolves.
export async function requireCustomer(): Promise<CustomerRecord> {
  const customer = await getCustomer();
  if (!customer) redirect('/login?error=session');
  return customer;
}
