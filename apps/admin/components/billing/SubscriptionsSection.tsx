'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle } from '@senso/ui';
import { callApi } from '@/lib/api-client';
import { formatDate, formatMoney, todayIso } from '@/lib/format';
import { TIER_LABEL } from '@/lib/billing/constants';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { SubscriptionForm, type SuggestedAdjustment } from '@/components/billing/SubscriptionForm';
import type { BillingSettings, Subscription } from '@/types/billing';

// The customer's plans: one card each, ended ones folded away below. After
// an edit that moves the monthly figure mid-term, a banner offers to draft
// the adjustment invoice; nothing is invoiced without that click.

type Props = { customerId: string; settings: BillingSettings; subscriptions: Subscription[]; now: number };

export function SubscriptionsSection({ customerId, settings, subscriptions, now }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjustment, setAdjustment] = useState<{ subscriptionId: string; suggestion: SuggestedAdjustment } | null>(null);
  const [error, setError] = useState('');

  const live = subscriptions.filter(s => s.endedAt === null);
  const ended = subscriptions.filter(s => s.endedAt !== null);

  async function endPlan(id: string) {
    setBusy(true);
    const result = await callApi(`/api/billing/subscriptions/${id}`, 'PATCH', { endedAt: todayIso(now) });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setEnding(null);
    router.refresh();
  }

  async function raiseAdjustment() {
    if (!adjustment) return;
    const { subscriptionId, suggestion } = adjustment;
    setBusy(true);
    const sign = suggestion.amount < 0 ? 'credit' : 'charge';
    const result = await callApi(`/api/billing/customers/${customerId}/invoices`, 'POST', {
      type: 'adjustment',
      subscriptionId,
      lines: [{
        description: `Mid-term ${sign}: ${formatMoney(Math.abs(suggestion.monthlyDifference))}/month × ${suggestion.monthsRemaining} months remaining`,
        quantity: suggestion.monthsRemaining,
        unitAmount: suggestion.monthlyDifference,
        amount: suggestion.amount,
      }],
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setAdjustment(null);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-hairline">
        <CardTitle>Plan</CardTitle>
        {editing === null && (
          <Button size="sm" onClick={() => { setError(''); setEditing('new'); }}>
            <Plus className="size-4" />
            {live.length === 0 ? 'Add plan' : 'Add another site'}
          </Button>
        )}
      </CardHeader>

      {editing === 'new' && (
        <div className="border-b border-hairline px-5 py-4">
          <SubscriptionForm customerId={customerId} settings={settings} existing={null} onCancel={() => setEditing(null)}
            onDone={() => { setEditing(null); router.refresh(); }} />
        </div>
      )}

      {adjustment && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-warn-soft px-5 py-3 text-sm">
          <p>
            The monthly figure moved by <span className="font-medium tabular-nums">{formatMoney(adjustment.suggestion.monthlyDifference)}</span> with{' '}
            {adjustment.suggestion.monthsRemaining} whole months left. Suggested adjustment:{' '}
            <span className="font-medium tabular-nums">{formatMoney(adjustment.suggestion.amount)}</span>.
          </p>
          <span className="flex gap-2">
            <Button size="sm" onClick={raiseAdjustment} disabled={busy}>Draft adjustment invoice</Button>
            <Button variant="ghost" size="sm" onClick={() => setAdjustment(null)} disabled={busy}>Not now</Button>
          </span>
        </div>
      )}

      {error && <p role="alert" className="px-5 pt-4 text-sm text-alert-text">{error}</p>}

      {live.length === 0 && editing !== 'new' && (
        <div className="m-5 rounded-inner border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No plan yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add one to propose the term total and the renewal date.</p>
        </div>
      )}

      <div className="divide-y divide-hairline">
        {live.map(s => editing === s.id ? (
          <div key={s.id} className="px-5 py-4">
            <SubscriptionForm customerId={customerId} settings={settings} existing={s} onCancel={() => setEditing(null)}
              onDone={suggestion => { setEditing(null); if (suggestion) setAdjustment({ subscriptionId: s.id, suggestion }); router.refresh(); }} />
          </div>
        ) : (
          <SubscriptionCard
            key={s.id}
            subscription={s}
            settings={settings}
            now={now}
            ending={ending === s.id}
            busy={busy}
            onEdit={() => { setError(''); setEditing(s.id); }}
            onAskEnd={() => setEnding(s.id)}
            onConfirmEnd={() => endPlan(s.id)}
            onCancelEnd={() => setEnding(null)}
          />
        ))}
      </div>

      {ended.length > 0 && (
        <details className="border-t border-hairline px-5 py-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">{ended.length} ended {ended.length === 1 ? 'plan' : 'plans'}</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {ended.map(s => (
              <li key={s.id}>{TIER_LABEL[s.tier]}{s.label ? ` · ${s.label}` : ''} · {s.termMonths} months · {formatMoney(s.termTotal)} · ended {formatDate(s.endedAt)}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
