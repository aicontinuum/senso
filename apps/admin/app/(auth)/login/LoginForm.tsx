'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@senso/ui';
import { createClient } from '@/lib/supabase/client';
import { DASHBOARD_PATH } from '@/lib/constants';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The server sends a signed-in non-admin back here with a reason in the
  // URL. The message is read from it; the only effect is signing out.
  const notAdmin = searchParams.get('error') === 'not_admin';
  useEffect(() => {
    if (notAdmin) createClient().auth.signOut();
  }, [notAdmin]);
  const shownError = error || (notAdmin ? 'Your account does not have admin access.' : '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    // A full page load, not a client-side route change. The server decides
    // where a signed-in user belongs (the dashboard, or back here with a
    // reason such as not_admin), and this form reads that reason from the
    // URL when it mounts. A client-side change to the URL already shown,
    // which is what a second attempt from an error page produces, would
    // not remount it, and the button would stay on "Signing in…".
    window.location.assign(DASHBOARD_PATH);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="next"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        placeholder="admin@example.com"
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        enterKeyHint="go"
        value={password}
        onChange={e => { setPassword(e.target.value); setError(''); }}
        placeholder="••••••••"
        error={shownError || undefined}
      />
      <Button type="submit" block disabled={loading || email.trim() === '' || password === ''}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
