'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { Branch } from '@/types/branches';

// One form for adding a branch and for editing one. Name is required; the
// address is free text that the branch's reports will print.

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    setSaving(true);
    const result = branch
      ? await callApi(`/api/customers/${customerId}/branches/${branch.id}`, 'PATCH', { name, address })
      : await callApi(`/api/customers/${customerId}/branches`, 'POST', { name, address });
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
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={!canSubmit}>{saving ? 'Saving…' : branch ? 'Save' : 'Add branch'}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </Card>
  );
}
