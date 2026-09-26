'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callApi } from '@/lib/api-client';
import { SETTINGS_GROUPS, formOf, type SettingsForm, type SettingsGroup } from '@/components/settings/billing-settings-groups';
import { SettingsGroupCard } from '@/components/settings/SettingsGroupCard';
import type { BillingSettings } from '@/types/billing';

// Every default the billing pages propose, one card per group, each read
// until its Edit is pressed. One card opens at a time. The settings are a
// single row and the route writes it whole, so a save sends the saved
// values of every other group along with this group's edits; nothing
// outside the open card can change. Changing a price here changes what is
// proposed for the next plan; it never touches an existing subscription
// or invoice.

export function BillingSettingsCards({ settings }: { settings: BillingSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(() => formOf(settings));
  const [open, setOpen] = useState<SettingsGroup['key'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<SettingsGroup['key'] | null>(null);
  const [error, setError] = useState('');

  function edit(key: SettingsGroup['key']) {
    setError('');
    setSavedKey(null);
    setOpen(key);
  }

  function cancel() {
    setForm(formOf(settings));
    setError('');
    setOpen(null);
  }

  async function save(key: SettingsGroup['key']) {
    setError('');
    setSaving(true);
    const result = await callApi<{ settings: BillingSettings }>('/api/billing/settings', 'PATCH', form);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setForm(formOf(result.data.settings));
    setOpen(null);
    setSavedKey(key);
    router.refresh();
  }

  const change = (key: keyof SettingsForm, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      {SETTINGS_GROUPS.map(group => (
        <SettingsGroupCard
          key={group.key}
          group={group}
          form={form}
          editing={open === group.key}
          locked={open !== null && open !== group.key}
          saving={saving && open === group.key}
          saved={savedKey === group.key}
          error={open === group.key ? error : ''}
          onChange={change}
          onEdit={() => edit(group.key)}
          onCancel={cancel}
          onSave={() => save(group.key)}
        />
      ))}
    </div>
  );
}
