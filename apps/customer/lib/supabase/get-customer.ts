import { createClient } from './server';

export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  created_at: string;
};

export async function getCustomer(): Promise<CustomerRecord | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, contact_name, phone, created_at')
    .eq('auth_user_id', user.id)
    .single();
  return data;
}
