'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DASHBOARD_PATH, LOCKED_ERROR } from '@/lib/constants';
import { Button, Input } from '@senso/ui';

// What the server says when it sends a signed-in user back here. The locked
// case has its own notice on the page, so it carries no message of its own.
const URL_ERRORS: Record<string, string> = {
  not_customer: 'This account is not registered as a customer.',
  session: 'We couldn’t load your account. Please sign in again.',
  [LOCKED_ERROR]: '',
};

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The reason is read from the URL; the only effect is ending the session
  // that the server refused.
  const urlError = searchParams.get('error');
  const sentBack = urlError !== null && urlError in URL_ERRORS;
  useEffect(() => {
    if (sentBack) createClient().auth.signOut();
  }, [sentBack]);
  const shownError = error || (sentBack ? URL_ERRORS[urlError] : '');

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
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="next"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        enterKeyHint="go"
        value={password}
        onChange={e => { setPassword(e.target.value); setError(''); }}
        placeholder="••••••••"
      />

      {/* Kept as a form-level message rather than a field error: it also covers
          cases like an account that is not a registered customer, which belong
          to neither field. */}
      {shownError && (
        <p role="alert" className="text-sm text-alert-text">{shownError}</p>
      )}

      <Button type="submit" block disabled={loading || email.trim() === '' || password === ''}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
