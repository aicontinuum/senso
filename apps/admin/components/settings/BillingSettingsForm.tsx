'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, Input } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import type { BillingSettings } from '@/types/billing';

// Every default the billing pages propose, in four groups: who is invoicing,
// where the money goes, the payment terms, and the price list. Saved as one
// row. Changing a price here changes what is proposed for the next plan; it
// never touches an existing subscription or invoice.

type Form = Record<keyof Omit<BillingSettings, 'taxRate'> | 'taxRatePercent', string>;

function formOf(s: BillingSettings): Form {
  return {
    companyName: s.companyName, crNumber: s.crNumber ?? '', address: s.address ?? '', phone: s.phone ?? '',
    billingEmail: s.billingEmail ?? '', logoUrl: s.logoUrl ?? '', bankName: s.bankName ?? '', accountName: s.accountName ?? '',
    iban: s.iban ?? '', fawranAlias: s.fawranAlias ?? '', taxRegistrationNumber: s.taxRegistrationNumber ?? '',
    taxRatePercent: String(s.taxRate * 100), invoicePrefix: s.invoicePrefix,
    onboardingDueDays: String(s.onboardingDueDays), renewalNoticeDays: String(s.renewalNoticeDays),
    suspensionAfterDays: String(s.suspensionAfterDays), starterMonthly: String(s.starterMonthly),
    standardMonthly: String(s.standardMonthly), addonMonthly: String(s.addonMonthly),
    addonMonthlyCustom: String(s.addonMonthlyCustom), monthsCharged6: String(s.monthsCharged6), monthsCharged12: String(s.monthsCharged12),
  };
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-5 py-5 first:border-t-0">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function BillingSettingsForm({ settings }: { settings: BillingSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(() => formOf(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const field = (key: keyof Form, label: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Input label={label} value={form[key]} onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setSaved(false); }} {...props} />
  );

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);
    const result = await callApi('/api/billing/settings', 'PATCH', form);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <CardTitle>Billing</CardTitle>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-medium text-ok-text">Saved.</span>}
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save billing settings'}</Button>
        </div>
      </CardHeader>

      <Group title="Who is invoicing" hint="Printed at the top of every invoice.">
        {field('companyName', 'Company name')}
        {field('crNumber', 'CR number')}
        {field('address', 'Address')}
        {field('phone', 'Phone', { type: 'tel' })}
        {field('billingEmail', 'Billing email', { type: 'email', hint: 'Reply-to on invoice emails.' })}
        {field('taxRegistrationNumber', 'Tax registration number', { hint: 'Blank until registered.' })}
        {field('logoUrl', 'Logo URL', { hint: 'Optional. A public image for the PDF header.' })}
      </Group>

      <Group title="Where the money goes" hint="Whichever of IBAN and Fawran is filled in is printed on the invoice.">
        {field('bankName', 'Bank')}
        {field('accountName', 'Account name')}
        {field('iban', 'IBAN', { className: 'font-mono' })}
        {field('fawranAlias', 'Fawran alias')}
      </Group>

      <Group title="Terms" hint="How the Billing page decides what needs action.">
        {field('invoicePrefix', 'Invoice prefix', { hint: 'Numbers read PREFIX-YYYY-NNNN.', className: 'font-mono uppercase' })}
        {field('taxRatePercent', 'Tax rate', { type: 'number', step: '0.01', min: 0, suffix: '%', hint: '0 prints no tax line.' })}
        {field('onboardingDueDays', 'Onboarding invoice due after', { type: 'number', min: 0, suffix: 'days', hint: '0 means due on receipt.' })}
        {field('renewalNoticeDays', 'Renewal notice window', { type: 'number', min: 0, suffix: 'days' })}
        {field('suspensionAfterDays', 'Suspension candidate after', { type: 'number', min: 0, suffix: 'days overdue' })}
      </Group>

      <Group title="Price list" hint="Proposed for new plans. Existing plans keep their figures.">
        {field('starterMonthly', 'Starter, per month', { type: 'number', step: '0.01', min: 0, suffix: 'QAR' })}
        {field('standardMonthly', 'Standard, per month', { type: 'number', step: '0.01', min: 0, suffix: 'QAR' })}
        {field('addonMonthly', 'Add-on sensor, per month', { type: 'number', step: '0.01', min: 0, suffix: 'QAR' })}
        {field('addonMonthlyCustom', 'Add-on sensor on Custom, per month', { type: 'number', step: '0.01', min: 0, suffix: 'QAR' })}
        {field('monthsCharged6', 'Months charged on a 6-month term', { type: 'number', min: 0 })}
        {field('monthsCharged12', 'Months charged on a 12-month term', { type: 'number', min: 0, hint: '11 gives one month free.' })}
      </Group>

      {error && <p role="alert" className="px-5 pb-5 text-sm text-alert-text">{error}</p>}
    </Card>
  );
}
