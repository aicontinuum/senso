'use client';

import { useState } from 'react';
import { Button, Card, Select } from '@senso/ui';
import { INVOICE_TYPE_LABEL, subscriptionLabel } from '@/lib/billing/constants';
import type { InvoiceType, Subscription } from '@/types/billing';

// Pick what the invoice is for. A term invoice needs a plan so its lines can
// be proposed; a one-off does not.

type Props = {
  subscriptions: Subscription[];
  onCreate: (type: InvoiceType, subscriptionId: string | null) => Promise<void>;
  onCancel: () => void;
};

const TYPES: InvoiceType[] = ['onboarding', 'renewal', 'adjustment'];

const HINT: Record<InvoiceType, string> = {
  onboarding: 'First term, proposed from the plan. Add hardware and installation as lines.',
  renewal: 'Next term, proposed from the plan. Due on the renewal date.',
  adjustment: 'A one-off: service visit, mid-term sensors, a credit. Starts empty.',
};

export function NewInvoiceForm({ subscriptions, onCreate, onCancel }: Props) {
  const [type, setType] = useState<InvoiceType>(subscriptions.length ? 'renewal' : 'adjustment');
  const [subscriptionId, setSubscriptionId] = useState<string>(subscriptions[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const needsPlan = type !== 'adjustment';
  const canCreate = !busy && (!needsPlan || subscriptionId !== '');

  return (
    <Card tone="sunken" className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Type" hint={HINT[type]} value={type} onChange={e => setType(e.target.value as InvoiceType)}>
          {TYPES.map(t => <option key={t} value={t}>{INVOICE_TYPE_LABEL[t]}</option>)}
        </Select>
        <Select label={needsPlan ? 'Plan' : 'Plan (optional)'} value={subscriptionId} onChange={e => setSubscriptionId(e.target.value)}
          hint={subscriptions.length === 0 && needsPlan ? 'Add a plan first.' : undefined}>
          {!needsPlan && <option value="">None</option>}
          {subscriptions.map(s => <option key={s.id} value={s.id}>{subscriptionLabel(s)}</option>)}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!canCreate} onClick={async () => { setBusy(true); await onCreate(type, subscriptionId || null); setBusy(false); }}>
          {busy ? 'Creating…' : 'Create draft'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </Card>
  );
}
