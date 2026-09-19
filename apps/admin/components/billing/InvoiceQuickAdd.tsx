'use client';

import { Plus } from 'lucide-react';
import { Button } from '@senso/ui';
import { subscriptionLabel } from '@/lib/billing/constants';
import { proposeLines, type LineInput } from '@/lib/billing/invoice-lines';
import type { BillingSettings, Invoice, InvoiceType, Subscription } from '@/types/billing';

// How a draft gets filled: one click per thing you usually bill for. A term
// button proposes the plan's lines and tells the editor which plan it was
// and whether that makes this an onboarding or a renewal, by looking at
// whether the plan has been billed for a term before. The admin sees none
// of that bookkeeping; the totals and Needs Action do.

type Props = {
  settings: BillingSettings;
  subscriptions: Subscription[];
  invoices: Invoice[];
  currentInvoiceId: string;
  onAdd: (lines: LineInput[], plan: { subscriptionId: string; type: InvoiceType } | null) => void;
};

const INSTALLATION_LINE: LineInput = { description: 'Installation', quantity: 1, unitAmount: 0, amount: 0 };
const HARDWARE_LINE: LineInput = { description: 'Hardware', quantity: 1, unitAmount: 0, amount: 0 };

export function inferTermType(subscriptionId: string, invoices: Invoice[], currentInvoiceId: string): InvoiceType {
  const billedBefore = invoices.some(i =>
    i.id !== currentInvoiceId
    && i.subscriptionId === subscriptionId
    && (i.state === 'sent' || i.state === 'paid')
    && (i.type === 'onboarding' || i.type === 'renewal'));
  return billedBefore ? 'renewal' : 'onboarding';
}

export function InvoiceQuickAdd({ settings, subscriptions, invoices, currentInvoiceId, onAdd }: Props) {
  const live = subscriptions.filter(s => s.endedAt === null);
  return (
    <div className="flex flex-wrap gap-2">
      {live.map(s => (
        <Button key={s.id} variant="soft" size="sm"
          onClick={() => onAdd(proposeLines(settings, 'renewal', s), { subscriptionId: s.id, type: inferTermType(s.id, invoices, currentInvoiceId) })}>
          <Plus className="size-4" />
          {live.length > 1 ? `Term · ${subscriptionLabel(s)}` : 'Term from plan'}
        </Button>
      ))}
      <Button variant="soft" size="sm" onClick={() => onAdd([INSTALLATION_LINE], null)}><Plus className="size-4" />Installation</Button>
      <Button variant="soft" size="sm" onClick={() => onAdd([HARDWARE_LINE], null)}><Plus className="size-4" />Hardware</Button>
      <Button variant="ghost" size="sm" onClick={() => onAdd([{ description: '', quantity: 1, unitAmount: 0, amount: 0 }], null)}><Plus className="size-4" />Blank line</Button>
    </div>
  );
}
