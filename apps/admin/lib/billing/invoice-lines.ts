// What a new invoice starts with. Term invoices propose one line for the plan
// and one for the add-ons; a one-off invoice starts empty. All of it is
// editable while the invoice is a draft.

import type { BillingSettings, InvoiceType, Subscription } from '@/types/billing';
import { monthsCharged, round2 } from '@/lib/billing/pricing';
import { TIER_LABEL } from '@/lib/billing/constants';
import { BillingInputError, requireMoney, requireText, MAX_LABEL } from '@/lib/billing/validate';

export type LineInput = {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
};

export const MAX_LINES = 50;

export function proposeLines(settings: BillingSettings, type: InvoiceType, subscription: Subscription | null): LineInput[] {
  if (!subscription || type === 'adjustment') return [];
  const months = monthsCharged(settings, subscription.termMonths);
  const term = `${subscription.termMonths} months`;
  const lines: LineInput[] = [{
    description: `${TIER_LABEL[subscription.tier]} plan, ${term} (${subscription.sensorCount} sensors)`,
    quantity: months,
    unitAmount: subscription.monthlyRate,
    amount: round2(subscription.monthlyRate * months),
  }];
  if (subscription.addonCount > 0) {
    lines.push({
      description: `Add-on sensors × ${subscription.addonCount}, ${term}`,
      quantity: months,
      unitAmount: round2(subscription.addonCount * subscription.addonMonthlyRate),
      amount: round2(subscription.addonCount * subscription.addonMonthlyRate * months),
    });
  }
  return lines;
}

/** Lines from a request body. `amount` is the stored figure; it defaults to
 *  quantity × unit and may be overridden. Negative amounts are allowed so a
 *  credit can appear on an adjustment. */
export function parseLines(value: unknown): LineInput[] {
  if (!Array.isArray(value)) throw new BillingInputError('lines must be a list');
  if (value.length > MAX_LINES) throw new BillingInputError(`at most ${MAX_LINES} lines`);
  return value.map((raw, i) => {
    if (!raw || typeof raw !== 'object') throw new BillingInputError(`line ${i + 1} is invalid`);
    const line = raw as Record<string, unknown>;
    const quantity = requireMoney(line.quantity ?? 1, `line ${i + 1} quantity`);
    const unitAmount = requireMoney(line.unitAmount ?? 0, `line ${i + 1} unit amount`, { min: -1e9 });
    const amount = line.amount === undefined || line.amount === ''
      ? round2(quantity * unitAmount)
      : requireMoney(line.amount, `line ${i + 1} amount`, { min: -1e9 });
    return { description: requireText(line.description, `line ${i + 1} description`, MAX_LABEL * 2), quantity, unitAmount, amount };
  });
}
