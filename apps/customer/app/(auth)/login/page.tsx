import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { LockedNotice, type SupportContact } from '@/components/LockedNotice';
import { createClient } from '@/lib/supabase/server';
import { APP_NAME, LOCKED_ERROR } from '@/lib/constants';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error } = await searchParams;
  const locked = error === LOCKED_ERROR;

  // Senso's contact details, for an account that was just locked out. Read
  // as whoever is here, signed in or not; the function hands out only these.
  let contact: SupportContact = { phone: null, email: null };
  if (locked) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('senso_support_contact').maybeSingle();
    const row = data as SupportContact | null;
    contact = { phone: row?.phone ?? null, email: row?.email ?? null };
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">{APP_NAME}</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to your account</p>
        {locked && <LockedNotice contact={contact} />}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
