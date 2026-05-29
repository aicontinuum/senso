import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShellClient } from '@/components/layout/ShellClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single();

  if (!customer) {
    redirect('/login?error=not_customer');
  }

  return <ShellClient customerName={customer.name}>{children}</ShellClient>;
}
