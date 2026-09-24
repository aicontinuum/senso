'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { EmailRecipientsEditor } from '@/components/EmailRecipientsEditor';
import type { Branch } from '@/types/branches';

// One form for adding a branch and for editing one. Name is required; the
// address is free text that the branch's reports print; the recipients,
// when set, replace the account list for this branch's alerts.

const RECIPIENTS_EMPTY = 'None of its own — this branch uses the account list.';

type Props = {
  customerId: string;
  /** Present when editing; absent when adding. */
  branch?: Branch;
  onDone: () => void;
  onCancel: () => void;
};

export function BranchForm({ customerId, branch, onDone, onCancel }: Props) {
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [recipients, setRecipients] = useState<string[]>(branch?.alertRecipients ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    setSaving(true);
    const result = branch
      ? await callApi(`/api/customers/${customerId}/branches/${branch.id}`, 'PATCH', { name, address, alertRecipients: recipients })
      : await callApi(`/api/customers/${customerId}/branches`, 'POST', { name, address, alertRecipients: recipients });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }

  const canSubmit = !saving && name.trim() !== '';

  return (
    <Card tone="sunken" className="space-y-4 p-4 animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      <p className="text-sm font-semibold">{branch ? 'Edit branch' : 'Add a branch'}</p>
      <Input
        label="Name"
        hint="How the customer refers to this location."
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && canSubmit && save()}
        placeholder="e.g. Lusail"
        error={error || undefined}
      />
      <Input
        label="Address"
        hint="Optional. Printed on this branch's reports."
        value={address}
        onChange={e => setAddress(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && canSubmit && save()}
        placeholder="e.g. Marina Promenade, Lusail"
      />
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Alert recipients</p>
        <p className="mb-3 text-xs text-muted-foreground">Emailed about this branch&apos;s sensors instead of the account list. Leave empty to use the account list.</p>
        <EmailRecipientsEditor emails={recipients} onChange={async next => { setRecipients(next); return true; }} emptyMessage={RECIPIENTS_EMPTY} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={!canSubmit}>{saving ? 'Saving…' : branch ? 'Save' : 'Add branch'}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </Card>
  );
}
