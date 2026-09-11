'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EmailRecipientsEditor } from '@/components/EmailRecipientsEditor';
import { GatewaysSection, type GatewayRow } from '@/components/customers/GatewaysSection';
import { SensorsSection, type SensorRow } from '@/components/customers/SensorsSection';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  alert_recipients: string[] | null;
};

interface Props {
  customer: CustomerRow;
  gateways: GatewayRow[];
  sensors: SensorRow[];
  /** Server clock at render, so relative times match the rest of the page. */
  now: number;
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-4"><h2 className="font-semibold">{title}</h2></div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-muted-foreground pt-1">{label}</dt>
      <dd className="col-span-2">
        {editing ? (
          <input
            value={value}
            onChange={e => onChange?.(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span>{value || '—'}</span>
        )}
      </dd>
    </div>
  );
}

export function CustomerDetailClient({ customer, gateways, sensors, now }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    name: customer.name,
    contactName: customer.contact_name ?? '',
    email: customer.email,
    phone: customer.phone ?? '',
  });
  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  async function saveAccount() {
    setSaveError('');
    const unchanged =
      form.name === customer.name &&
      form.contactName === (customer.contact_name ?? '') &&
      form.email === customer.email &&
      form.phone === (customer.phone ?? '');
    if (unchanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
        }),
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

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [acctEmails, setAcctEmails] = useState<string[]>(customer.alert_recipients ?? []);
  const [savingAcctEmails, setSavingAcctEmails] = useState(false);
  const [acctEmailError, setAcctEmailError] = useState('');

  async function saveAcctEmails(emails: string[]) {
    setAcctEmails(emails);
    setAcctEmailError('');
    setSavingAcctEmails(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customer.name,
          contactName: customer.contact_name,
          email: customer.email,
          phone: customer.phone,
          alertRecipients: emails,
        }),
      });
      const data = await res.json();
      if (!res.ok) setAcctEmailError(data.error ?? 'Failed to save');
    } finally {
      setSavingAcctEmails(false);
    }
  }

  async function updatePassword() {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
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
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Customers
      </Link>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
        {!editing ? (
          <button onClick={() => { setSaveError(''); setEditing(true); }} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Edit</button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setSaveError(''); setForm({ name: customer.name, contactName: customer.contact_name ?? '', email: customer.email, phone: customer.phone ?? '' }); }} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Cancel</button>
              <button onClick={saveAccount} disabled={saving} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {saveError && <p className="text-xs text-alert-text">{saveError}</p>}
          </div>
        )}
      </div>

      <Section title="Account Info">
        <dl className="space-y-3">
          <Field label="Business Name" value={form.name}        editing={editing} onChange={set('name')} />
          <Field label="Contact Name"  value={form.contactName} editing={editing} onChange={set('contactName')} />
          <Field label="Email"         value={form.email}       editing={editing} onChange={set('email')} />
          <Field label="Phone"         value={form.phone}       editing={editing} onChange={set('phone')} />
        </dl>
        <div className="mt-5 border-t pt-4">
          <p className="mb-2 text-sm font-medium">Change Password</p>
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
                onKeyDown={e => e.key === 'Enter' && updatePassword()}
                placeholder="New password"
                className={`w-48 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${passwordError ? 'border-alert-border focus:ring-alert-500' : 'border-border'}`}
              />
              <button
                onClick={updatePassword}
                disabled={passwordSaving || !newPassword}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? 'Updating…' : 'Update'}
              </button>
            </div>
            {passwordError && <p className="text-xs text-alert-text">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-ok-text">Password updated.</p>}
          </div>
        </div>
      </Section>

      <GatewaysSection customerId={customer.id} gateways={gateways} sensors={sensors} now={now} />

      <SensorsSection customerId={customer.id} gateways={gateways} sensors={sensors} />

      <Section title="Alert Recipients">
        <p className="mb-4 text-sm text-muted-foreground">
          These emails receive alerts from every sensor on this account. This is the only recipient list — the customer edits the same one in their Settings.
        </p>
        <EmailRecipientsEditor emails={acctEmails} onChange={saveAcctEmails} />
        {savingAcctEmails && <p className="mt-2 text-xs text-muted-foreground">Saving…</p>}
        {acctEmailError && <p className="mt-2 text-xs text-alert-text">{acctEmailError}</p>}
      </Section>
    </div>
  );
}
