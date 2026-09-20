'use client';

import { CalendarOff, Pencil } from 'lucide-react';
import { Button } from '@senso/ui';
import { daysUntil, formatDate, formatDaysRelative, formatMoney } from '@/lib/format';
import { TERM_LABEL, TIER_LABEL } from '@/lib/billing/constants';
import { effectiveMonthly, listMonthlyRate } from '@/lib/billing/pricing';
import { InlinePanel } from '@/components/billing/InlinePanel';
import type { BillingSettings, Subscription } from '@/types/billing';

// The plan block and the term block for one subscription: what they are on,
// what they pay a month (with the list figure only when they are below it),
// and where they are in the term. Days remaining turns amber inside the renewal notice window and red
// once the renewal date has passed. Ending the plan is destructive and reads
// as such: an alert-tinted icon button, confirmed in a panel under the plan.

type Props = {
  subscription: Subscription;
  settings: BillingSettings;
  now: number;
  ending: boolean;
  busy: boolean;
  error: string;
  onEdit: () => void;
  onAskEnd: () => void;
  onConfirmEnd: () => void;
  onCancelEnd: () => void;
};

function Stat({ label, children, tone, note }: { label: string; children: React.ReactNode; tone?: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium tabular-nums ${tone ?? ''}`}>{children}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

export function SubscriptionCard({ subscription: s, settings, now, ending, busy, error, onEdit, onAskEnd, onConfirmEnd, onCancelEnd }: Props) {
  // Monthly is what this customer pays. The list figure only appears when it
  // differs, as a note: a discount is worth seeing, a match is not.
  const listBase = listMonthlyRate(settings, s.tier);
  const list = listBase === null ? null : effectiveMonthly(listBase, s.addonCount, s.addonMonthlyRate);
  const monthly = effectiveMonthly(s.monthlyRate, s.addonCount, s.addonMonthlyRate);
  const discounted = list !== null && monthly < list;
  const days = s.renewalDate ? daysUntil(s.renewalDate, now) : null;
  const daysTone = days === null ? undefined
    : days < 0 ? 'text-alert-text'
    : days <= settings.renewalNoticeDays ? 'text-warn-text'
    : undefined;
  const name = `${TIER_LABEL[s.tier]}${s.label ? ` · ${s.label}` : ''}`;

  return (
    <div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">
            {TIER_LABEL[s.tier]}{s.label && <span className="text-muted-foreground"> · {s.label}</span>}
          </p>
          {!ending && (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="size-4" />Edit</Button>
              <Button variant="ghost" size="icon" aria-label={`End the ${name} plan`} title="End plan" className="hover:text-alert-text" onClick={onAskEnd}>
                <CalendarOff className="size-4" />
              </Button>
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Sensors">{s.sensorCount}{s.addonCount > 0 && <span className="text-muted-foreground"> + {s.addonCount} add-on</span>}</Stat>
          <Stat label="Term">{TERM_LABEL[s.termMonths]}</Stat>
          <Stat label="Monthly" tone={discounted ? 'text-warn-text' : undefined} note={discounted && list !== null ? `list ${formatMoney(list)}, on discount` : undefined}>{formatMoney(monthly)}</Stat>
          <Stat label="Term total">{formatMoney(s.termTotal)}</Stat>
          <Stat label="Term start">{formatDate(s.termStart)}</Stat>
          <Stat label="Renewal">{formatDate(s.renewalDate)}</Stat>
          <Stat label="Days remaining" tone={daysTone}>
            {days === null ? '—' : days < 0 ? `passed ${formatDaysRelative(days)}` : days}
          </Stat>
        </dl>
      </div>
      {ending && (
        <div className="border-t border-hairline bg-sunken px-5 py-4">
          <InlinePanel
            title={`End the ${name} plan?`}
            description="Ends today and moves to the ended list. Invoices and payments stay; no further renewal is proposed."
            error={error}
            confirmLabel="End plan"
            busyLabel="Ending…"
            busy={busy}
            danger
            onConfirm={onConfirmEnd}
            onCancel={onCancelEnd}
          />
        </div>
      )}
    </div>
  );
}
