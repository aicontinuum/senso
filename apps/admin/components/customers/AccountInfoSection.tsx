'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Pencil } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Input } from '@senso/ui';

// Who the customer is and how to reach them, editable in place, plus the
// office-side password reset a technician uses when handing over credentials.

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  alert_recipients: string[] | null;
};

const PASSWORD_MIN_LENGTH = 8;

function formOf(customer: CustomerRow) {
  return {
    name: customer.name,
    contactName: customer.contact_name ?? '',
    email: customer.email,
    phone: customer.phone ?? '',
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:pt-2.5">{label}</dt>
      <dd className="text-sm sm:col-span-2">{children}</dd>
    </div>
  );
}

export function AccountInfoSection({ customer }: { customer: CustomerRow }) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState(() => formOf(customer));
  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  function cancelEditing() {
    setEditing(false);
    setSaveError('');
    setForm(formOf(customer));
  }

  async function saveAccount() {
    setSaveError('');
    const initial = formOf(customer);
    const unchanged = (Object.keys(form) as (keyof typeof form)[]).every(k => form[k] === initial[k]);
    if (unchanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save changes');
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword() {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error ?? 'Failed to update password');
        return;
      }
      setNewPassword('');
      setPasswordSuccess(true);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <CardTitle>Account info</CardTitle>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => { setSaveError(''); setEditing(true); }}>
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEditing} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={saveAccount} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        )}
      </CardHeader>

      <dl className="space-y-4 px-5 py-5">
        <Field label="Business name">
          {editing ? <Input value={form.name} onChange={e => set('name')(e.target.value)} /> : <span className="font-medium">{form.name}</span>}
        </Field>
        <Field label="Contact name">
          {editing ? <Input value={form.contactName} onChange={e => set('contactName')(e.target.value)} /> : form.contactName || <span className="text-muted-foreground">—</span>}
        </Field>
        <Field label="Email">
          {editing ? <Input type="email" value={form.email} onChange={e => set('email')(e.target.value)} /> : form.email}
        </Field>
        <Field label="Phone">
          {editing ? <Input type="tel" value={form.phone} onChange={e => set('phone')(e.target.value)} /> : form.phone || <span className="text-muted-foreground">—</span>}
        </Field>
        {saveError && <p role="alert" className="text-sm text-alert-text">{saveError}</p>}
      </dl>

      <div className="border-t border-hairline px-5 py-4">
        <p className="mb-2 text-sm font-semibold">Change password</p>
        {/* Stacks on a phone: side by side the button falls off the card edge. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
            onKeyDown={e => e.key === 'Enter' && updatePassword()}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            error={passwordError || undefined}
            hint={passwordSuccess ? undefined : `At least ${PASSWORD_MIN_LENGTH} characters.`}
            wrapperClassName="max-w-xs"
          />
          <Button variant="secondary" className="self-start" onClick={updatePassword} disabled={passwordSaving || newPassword === ''}>
            <KeyRound className="size-4" />
            {passwordSaving ? 'Updating…' : 'Update'}
          </Button>
        </div>
        {passwordSuccess && <p className="mt-1.5 text-sm font-medium text-ok-text">Password updated.</p>}
      </div>
    </Card>
  );
}
