import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCustomer, isSuspended } from '@/lib/supabase/get-customer';
import { ShellClient } from '@/components/layout/ShellClient';
import { LockedAccount, type SupportContact } from '@/components/LockedAccount';

// Every page inside the app passes through here. A suspended account never
// reaches a page: it gets the lock screen instead, whatever the URL, and
// only logging out works. Readings keep being recorded and alerts keep
// going out; only the app is withheld.

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
    const { data } = await supabase.rpc('senso_support_contact').maybeSingle();
    const row = data as { phone: string | null; email: string | null } | null;
    const contact: SupportContact = { phone: row?.phone ?? null, email: row?.email ?? null };
    return <LockedAccount customerName={customer.name} contact={contact} />;
  }

  return <ShellClient customerName={customer.name}>{children}</ShellClient>;
}
