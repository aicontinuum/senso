'use client';

import { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@senso/ui';
import { EmailRecipientsEditor } from '@/components/EmailRecipientsEditor';
import type { CustomerRow } from './AccountInfoSection';

// The one recipient list for the account. Saved on every change rather than
// behind a Save button: a technician adds an address, sees it land, moves on.

export function AlertRecipientsSection({ customer }: { customer: CustomerRow }) {
  const [emails, setEmails] = useState<string[]>(customer.alert_recipients ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(next: string[]): Promise<boolean> {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customer.name,
          contactName: customer.contact_name,
          email: customer.email,
          phone: customer.phone,
          alertRecipients: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Please try again.');
        return false;
      }
      setEmails(next);
      return true;
    } catch {
      setError('Could not save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-hairline">
        <CardTitle>Alert recipients</CardTitle>
        <CardDescription>
          These addresses receive alerts from every sensor on this account. It is the only list; the customer edits the same one in their Settings.
        </CardDescription>
      </CardHeader>
      <div className="px-5 py-5">
        <EmailRecipientsEditor emails={emails} onChange={save} saving={saving} />
        {saving && <p className="mt-3 text-xs text-muted-foreground">Saving…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-alert-text">{error}</p>}
      </div>
    </Card>
  );
}
