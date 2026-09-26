import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCustomer, isSuspended } from '@/lib/supabase/get-customer';
import { ShellClient } from '@/components/layout/ShellClient';
import { LOCKED_ERROR } from '@/lib/constants';

// Every page inside the app passes through here. A suspended account never
// reaches a page: its session is ended on the spot and it lands on the
// login page with the locked notice, whatever it was doing. Readings keep
// being recorded and alerts keep going out; only the app is withheld.
// Reactivating on admin lets the next sign-in through.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCustomer();
  if (!customer) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    redirect(user ? '/login?error=not_customer' : '/login');
  }

  if (isSuspended(customer)) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(`/login?error=${LOCKED_ERROR}`);
  }

  return <ShellClient customerName={customer.name}>{children}</ShellClient>;
}
