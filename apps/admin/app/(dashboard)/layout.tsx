import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShellClient } from '@/components/layout/ShellClient';

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (user.app_metadata?.role !== 'admin') {
    redirect('/login?error=not_admin');
  }

  return <ShellClient>{children}</ShellClient>;
}
