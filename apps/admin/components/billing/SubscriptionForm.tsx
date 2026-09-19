'use client';

import { useState } from 'react';
import { Button, Card, Input, Select } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { TERM_LABEL, TIER_LABEL } from '@/lib/billing/constants';
import { proposeSubscription, renewalDateFor, suggestTier, round2 } from '@/lib/billing/pricing';
import type { BillingSettings, BillingTier, Subscription, TermMonths } from '@/types/billing';

// One form for a new plan and for editing one. Every money field and date
// shows what the system proposes and takes whatever the admin types; a field
// left blank means "use the proposal". The reason is optional and lands in
// the change log next to each override.

export type SuggestedAdjustment = { amount: number; monthlyDifference: number; monthsRemaining: number };

type Props = {
  customerId: string;
  settings: BillingSettings;
  existing: Subscription | null;
  onDone: (adjustment: SuggestedAdjustment | null) => void;
  onCancel: () => void;
};

const TIERS: BillingTier[] = ['starter', 'standard', 'custom'];

function initial(existing: Subscription | null) {
  return {
    label: existing?.label ?? '',
    tier: existing?.tier ?? 'starter',
    sensorCount: String(existing?.sensorCount ?? 1),
    addonCount: String(existing?.addonCount ?? 0),
    termMonths: (existing?.termMonths ?? 12) as TermMonths,
    termStart: existing?.termStart ?? '',
    monthlyRate: existing ? String(existing.monthlyRate) : '',
    addonMonthlyRate: existing ? String(existing.addonMonthlyRate) : '',
    termTotal: existing ? String(existing.termTotal) : '',
    // A stored plan keeps its date; a new one gets the proposal as soon as a start is typed.
    renewalDate: existing?.renewalDate ?? (existing?.termStart ? renewalDateFor(existing.termStart, existing.termMonths) : ''),
    reason: '',
  };
}

export function SubscriptionForm({ customerId, settings, existing, onDone, onCancel }: Props) {
  const [form, setForm] = useState(() => initial(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  // The renewal date follows the term start and the term length; typing over
  // it afterwards is the override, and it is logged as one.
  function changeTermStart(value: string) {
    setForm(f => ({ ...f, termStart: value, renewalDate: value ? renewalDateFor(value, f.termMonths) : f.renewalDate }));
  }
  function changeTermMonths(value: TermMonths) {
    setForm(f => ({ ...f, termMonths: value, renewalDate: f.termStart ? renewalDateFor(f.termStart, value) : f.renewalDate }));
  }

  const addonCount = Number.parseInt(form.addonCount, 10) || 0;
  const sensorCount = Number.parseInt(form.sensorCount, 10) || 0;
  const proposal = proposeSubscription(settings, form.tier, addonCount, form.termMonths);
  const monthly = form.monthlyRate === '' ? proposal.monthlyRate : Number.parseFloat(form.monthlyRate);
  const addonRate = form.addonMonthlyRate === '' ? proposal.addonMonthlyRate : Number.parseFloat(form.addonMonthlyRate);
  const proposedTotal = monthly === null || !Number.isFinite(monthly) || !Number.isFinite(addonRate)
    ? null
    : round2((monthly + addonCount * addonRate) * proposal.monthsCharged);
  const proposedRenewal = form.termStart ? renewalDateFor(form.termStart, form.termMonths) : '';
  const suggested = suggestTier(sensorCount);

  async function save() {
    setError('');
    setSaving(true);
    const body = {
      label: form.label, tier: form.tier, sensorCount, addonCount, termMonths: form.termMonths,
      termStart: form.termStart || null, monthlyRate: form.monthlyRate, addonMonthlyRate: form.addonMonthlyRate,
      termTotal: form.termTotal, renewalDate: form.renewalDate, reason: form.reason,
    };
    const result = existing
      ? await callApi<{ suggestedAdjustment?: SuggestedAdjustment | null }>(`/api/billing/subscriptions/${existing.id}`, 'PATCH', body)
      : await callApi<{ suggestedAdjustment?: SuggestedAdjustment | null }>(`/api/billing/customers/${customerId}/subscriptions`, 'POST', body);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    onDone(result.data.suggestedAdjustment ?? null);
  }

  const money = (v: number | null) => (v === null ? 'set by hand' : formatMoney(v));

  return (
    <Card tone="sunken" className="space-y-4 p-4">
      <p className="text-sm font-semibold">{existing ? 'Edit plan' : 'New plan'}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Label (optional)" hint="For a customer with more than one site." value={form.label} onChange={e => set('label')(e.target.value)} placeholder="e.g. Al Sadd branch" />
        <Select label="Tier" hint={sensorCount > 0 && suggested !== form.tier ? `${sensorCount} sensors usually means ${TIER_LABEL[suggested]}.` : undefined} value={form.tier} onChange={e => set('tier')(e.target.value)}>
          {TIERS.map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </Select>
        <Input label="Sensors" type="number" min={0} value={form.sensorCount} onChange={e => set('sensorCount')(e.target.value)} />
        <Input label="Add-on sensors" type="number" min={0} value={form.addonCount} onChange={e => set('addonCount')(e.target.value)} />
        <Select label="Term" value={String(form.termMonths)} onChange={e => changeTermMonths(Number(e.target.value) as TermMonths)}>
          <option value="12">{TERM_LABEL[12]} (12 months, pays {settings.monthsCharged12})</option>
          <option value="6">{TERM_LABEL[6]} (6 months, pays {settings.monthsCharged6})</option>
        </Select>
        <Input label="Term start" hint="Installation day. The renewal date fills in one term later." type="date" value={form.termStart} onChange={e => changeTermStart(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Monthly rate" hint={`Proposed: ${money(proposal.monthlyRate)}`} type="number" step="0.01" value={form.monthlyRate} onChange={e => set('monthlyRate')(e.target.value)} placeholder={proposal.monthlyRate === null ? 'required for Custom' : String(proposal.monthlyRate)} />
        <Input label="Add-on rate, per sensor per month" hint={`Proposed: ${formatMoney(proposal.addonMonthlyRate)}`} type="number" step="0.01" value={form.addonMonthlyRate} onChange={e => set('addonMonthlyRate')(e.target.value)} placeholder={String(proposal.addonMonthlyRate)} />
        <Input label="Term total" hint={`Proposed: ${money(proposedTotal)} for ${proposal.monthsCharged} months charged`} type="number" step="0.01" value={form.termTotal} onChange={e => set('termTotal')(e.target.value)} placeholder={proposedTotal === null ? '' : String(proposedTotal)} />
        <Input label="Renewal date" hint={proposedRenewal ? (form.renewalDate === proposedRenewal ? 'One term after the start. Change it if agreed otherwise.' : `Proposed: ${proposedRenewal}`) : 'Set a term start and this fills in.'} type="date" value={form.renewalDate} onChange={e => set('renewalDate')(e.target.value)} />
      </div>

      <Input label="Reason (optional)" hint="Stored in the change log next to anything that differs from the proposal." value={form.reason} onChange={e => set('reason')(e.target.value)} placeholder="e.g. pilot pricing until March" />

      {error && <p role="alert" className="text-sm text-alert-text">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : existing ? 'Save plan' : 'Create plan'}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </Card>
  );
}
