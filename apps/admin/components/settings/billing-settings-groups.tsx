import type { ComponentProps, ReactNode } from 'react';
import type { Input } from '@senso/ui';
import { CURRENCY, formatAmount } from '@/lib/format';
import type { BillingSettings } from '@/types/billing';

// The billing settings as the page shows them: four groups, each a card
// that is read most of the time and edited now and then. Every field says
// how it reads when closed and how it is typed when open, once, here.

export type SettingsForm = Record<keyof Omit<BillingSettings, 'taxRate'> | 'taxRatePercent', string>;

export function formOf(s: BillingSettings): SettingsForm {
  return {
    companyName: s.companyName, crNumber: s.crNumber ?? '', address: s.address ?? '', phone: s.phone ?? '',
    billingEmail: s.billingEmail ?? '', logoUrl: s.logoUrl ?? '', bankName: s.bankName ?? '', accountName: s.accountName ?? '',
    iban: s.iban ?? '', fawranAlias: s.fawranAlias ?? '', taxRegistrationNumber: s.taxRegistrationNumber ?? '',
    taxRatePercent: String(s.taxRate * 100), invoicePrefix: s.invoicePrefix,
    paymentTermsDays: String(s.paymentTermsDays), renewalNoticeDays: String(s.renewalNoticeDays),
    suspensionAfterDays: String(s.suspensionAfterDays), starterMonthly: String(s.starterMonthly),
    standardMonthly: String(s.standardMonthly), addonMonthly: String(s.addonMonthly),
    addonMonthlyCustom: String(s.addonMonthlyCustom),
  };
}

export type SettingsField = {
  key: keyof SettingsForm;
  label: string;
  /** The value as read. Empty comes back as null and the card draws a dash. */
  view?: (value: string) => ReactNode;
  /** What the field looks like when typed into. */
  input?: Partial<ComponentProps<typeof Input>>;
  /** Class on the read value: monospace for codes. */
  viewClassName?: string;
};

export type SettingsGroup = {
  key: 'invoicing' | 'payment' | 'terms' | 'prices';
  title: string;
  hint: string;
  fields: SettingsField[];
};

const NUMBER = { type: 'number', inputMode: 'decimal', step: '0.01', min: 0 } as const;
const COUNT = { type: 'number', inputMode: 'numeric', min: 0 } as const;

const days = (value: string) => `${value} ${value === '1' ? 'day' : 'days'}`;
// Amount first, the way every figure on the billing pages reads.
const money = (value: string) => `${formatAmount(Number(value))} ${CURRENCY}`;

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: 'invoicing',
    title: 'Invoicing',
    hint: 'Printed at the top of every invoice.',
    fields: [
      { key: 'companyName', label: 'Company name' },
      { key: 'crNumber', label: 'CR number' },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone', input: { type: 'tel', inputMode: 'tel' } },
      { key: 'billingEmail', label: 'Billing email', input: { type: 'email', inputMode: 'email', autoCapitalize: 'none', autoCorrect: 'off', hint: 'Reply-to on invoice emails.' } },
      { key: 'taxRegistrationNumber', label: 'Tax registration number', input: { hint: 'Blank until registered.' } },
      { key: 'logoUrl', label: 'Logo', input: { type: 'url', inputMode: 'url', hint: 'Optional. A public image URL for the PDF header.' }, viewClassName: 'break-all' },
    ],
  },
  {
    key: 'payment',
    title: 'Payment details',
    hint: 'Whichever of IBAN and Fawran is filled in is printed on the invoice.',
    fields: [
      { key: 'bankName', label: 'Bank' },
      { key: 'accountName', label: 'Account name' },
      { key: 'iban', label: 'IBAN', input: { className: 'font-mono', autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false }, viewClassName: 'font-mono' },
      { key: 'fawranAlias', label: 'Fawran alias' },
    ],
  },
  {
    key: 'terms',
    title: 'Terms',
    hint: 'How the Billing page decides what needs action.',
    fields: [
      { key: 'invoicePrefix', label: 'Invoice prefix', input: { hint: 'Numbers read PREFIX-YYYY-NNNN.', className: 'font-mono uppercase' }, viewClassName: 'font-mono' },
      { key: 'taxRatePercent', label: 'Tax rate', view: v => `${v}%`, input: { ...NUMBER, suffix: '%', hint: '0 prints no tax line.' } },
      { key: 'paymentTermsDays', label: 'Payment terms', view: days, input: { ...COUNT, suffix: 'days', hint: 'Due date proposed as issue date plus this.' } },
      { key: 'renewalNoticeDays', label: 'Renewal notice window', view: days, input: { ...COUNT, suffix: 'days' } },
      { key: 'suspensionAfterDays', label: 'Suspension candidate after', view: v => `${days(v)} overdue`, input: { ...COUNT, suffix: 'days overdue' } },
    ],
  },
  {
    key: 'prices',
    title: 'Price list',
    hint: 'Proposed for new plans. Existing plans keep their figures.',
    fields: [
      { key: 'starterMonthly', label: 'Starter, per month', view: money, input: { ...NUMBER, suffix: 'QAR' } },
      { key: 'standardMonthly', label: 'Standard, per month', view: money, input: { ...NUMBER, suffix: 'QAR' } },
      { key: 'addonMonthly', label: 'Add-on sensor, per month', view: money, input: { ...NUMBER, suffix: 'QAR' } },
      { key: 'addonMonthlyCustom', label: 'Add-on sensor on Custom, per month', view: money, input: { ...NUMBER, suffix: 'QAR' } },
    ],
  },
];
