'use client';

import { Pencil } from 'lucide-react';
import { Button } from '@senso/ui';
import { daysUntil, formatDate, formatDaysRelative, formatMoney } from '@/lib/format';
import { TIER_LABEL } from '@/lib/billing/constants';
import { effectiveMonthly, listMonthlyRate } from '@/lib/billing/pricing';
import type { BillingSettings, Subscription } from '@/types/billing';

// The plan block and the term block for one subscription: what they are on,
// what they actually pay against the list rate, and where they are in the
// term. Days remaining turns amber inside the renewal notice window and red
// once the renewal date has passed.

type Props = {
  subscription: Subscription;
  settings: BillingSettings;
  now: number;
  ending: boolean;
  busy: boolean;
  onEdit: () => void;
  onAskEnd: () => void;
  onConfirmEnd: () => void;
  onCancelEnd: () => void;
};

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium tabular-nums ${tone ?? ''}`}>{children}</dd>
    </div>
  );
}

export function SubscriptionCard({ subscription: s, settings, now, ending, busy, onEdit, onAskEnd, onConfirmEnd, onCancelEnd }: Props) {
  const list = listMonthlyRate(settings, s.tier);
  const paid = effectiveMonthly(s.monthlyRate, s.addonCount, s.addonMonthlyRate);
  const days = s.renewalDate ? daysUntil(s.renewalDate, now) : null;
  const daysTone = days === null ? undefined
    : days < 0 ? 'text-alert-text'
    : days <= settings.renewalNoticeDays ? 'text-warn-text'
    : undefined;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {TIER_LABEL[s.tier]}{s.label && <span className="text-muted-foreground"> · {s.label}</span>}
        </p>
        <span className="flex gap-1">
          {ending ? (
            <>
              <span className="self-center text-xs text-muted-foreground">End this plan today?</span>
              <Button variant="danger" size="sm" onClick={onConfirmEnd} disabled={busy}>End plan</Button>
              <Button variant="ghost" size="sm" onClick={onCancelEnd} disabled={busy}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="size-4" />Edit</Button>
              <Button variant="ghost" size="sm" onClick={onAskEnd}>End</Button>
            </>
          )}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Sensors">{s.sensorCount}{s.addonCount > 0 && <span className="text-muted-foreground"> + {s.addonCount} add-on</span>}</Stat>
        <Stat label="Term">{s.termMonths} months</Stat>
        <Stat label="Monthly paid" tone={list !== null && paid < list + s.addonCount * s.addonMonthlyRate ? 'text-warn-text' : undefined}>{formatMoney(paid)}</Stat>
        <Stat label="List rate">{list === null ? '—' : formatMoney(list + s.addonCount * s.addonMonthlyRate)}</Stat>
        <Stat label="Term total">{formatMoney(s.termTotal)}</Stat>
        <Stat label="Term start">{formatDate(s.termStart)}</Stat>
        <Stat label="Renewal">{formatDate(s.renewalDate)}</Stat>
        <Stat label="Days remaining" tone={daysTone}>
          {days === null ? '—' : days < 0 ? `passed ${formatDaysRelative(days)}` : days}
        </Stat>
      </dl>
    </div>
  );
}
