// The subscription form's body, parsed and checked, plus the proposal it is
// compared against so overrides can be logged. Shared by create and edit.

import type { BillingSettings, BillingTier, TermMonths } from '@/types/billing';
import { proposeSubscription, renewalDateFor } from '@/lib/billing/pricing';
import {
  BillingInputError, optionalDate, optionalText, requireCount, requireMoney, requireTermMonths, requireTier, MAX_LABEL,
} from '@/lib/billing/validate';

export type SubscriptionInput = {
  label: string | null;
  tier: BillingTier;
  sensorCount: number;
  addonCount: number;
  addonMonthlyRate: number;
  termMonths: TermMonths;
  monthlyRate: number;
  termTotal: number;
  termStart: string | null;
  renewalDate: string | null;
  reason: string | null;
};

export function parseSubscriptionInput(body: Record<string, unknown>, settings: BillingSettings): SubscriptionInput {
  const tier = requireTier(body.tier);
  const termMonths = requireTermMonths(body.termMonths);
  const addonCount = requireCount(body.addonCount, 'add-on count');
  const proposal = proposeSubscription(settings, tier, addonCount, termMonths);
  const termStart = optionalDate(body.termStart, 'term start');

  // Anything missing from the body takes the proposal; anything present is the
  // admin's figure, even when it matches.
  const monthlyRate = body.monthlyRate === undefined || body.monthlyRate === ''
    ? proposal.monthlyRate
    : requireMoney(body.monthlyRate, 'monthly rate');
  if (monthlyRate === null) throw new BillingInputError('monthly rate is required for a Custom plan');
  const addonMonthlyRate = body.addonMonthlyRate === undefined || body.addonMonthlyRate === ''
    ? proposal.addonMonthlyRate
    : requireMoney(body.addonMonthlyRate, 'add-on rate');
  const termTotal = body.termTotal === undefined || body.termTotal === ''
    ? Math.round((monthlyRate + addonCount * addonMonthlyRate) * termMonths * 100) / 100
    : requireMoney(body.termTotal, 'term total');
  const renewalDate = body.renewalDate === undefined || body.renewalDate === ''
    ? (termStart ? renewalDateFor(termStart, termMonths) : null)
    : optionalDate(body.renewalDate, 'renewal date');

  return {
    label: optionalText(body.label, 'label', MAX_LABEL),
    tier,
    sensorCount: requireCount(body.sensorCount, 'sensor count'),
    addonCount,
    addonMonthlyRate,
    termMonths,
    monthlyRate,
    termTotal,
    termStart,
    renewalDate,
    reason: optionalText(body.reason, 'reason'),
  };
}

/** The figures the system would have used, keyed as the columns are, for the
 *  override log. */
export function proposalFor(settings: BillingSettings, input: SubscriptionInput): Record<string, string | number | null> {
  const proposal = proposeSubscription(settings, input.tier, input.addonCount, input.termMonths);
  return {
    monthly_rate: proposal.monthlyRate,
    addon_monthly_rate: proposal.addonMonthlyRate,
    term_total: proposal.termTotal,
    renewal_date: input.termStart ? renewalDateFor(input.termStart, input.termMonths) : null,
  };
}
