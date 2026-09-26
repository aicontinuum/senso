'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DASHBOARD_PATH, LOCKED_ERROR } from '@/lib/constants';
import { Button } from '@senso/ui';
import { Input } from '@senso/ui';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'not_customer') {
      setLoading(false);
      setError('This account is not registered as a customer.');
      createClient().auth.signOut();
    } else if (err === 'session') {
      setLoading(false);
      setError('We couldn’t load your account. Please sign in again.');
      createClient().auth.signOut();
    } else if (err === LOCKED_ERROR) {
      // The page shows the locked notice; here only the session is ended.
      setLoading(false);
      setError('');
      createClient().auth.signOut();
    } else {
      setError('');
    }
  }, [searchParams]);

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
    // reason such as locked or not_customer), and this form reads that
    // reason from the URL when it mounts. A client-side change to the URL
    // already shown, which is what a second attempt from an error page
    // produces, would not remount it, and the button would stay on
    // "Signing in…".
    window.location.assign(DASHBOARD_PATH);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        required
      />

      {/* Kept as a form-level message rather than a field error: it also covers
          cases like an account that is not a registered customer, which belong
          to neither field. */}
      {error && (
        <p role="alert" className="text-sm text-alert-text">{error}</p>
      )}

      <Button type="submit" block disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
