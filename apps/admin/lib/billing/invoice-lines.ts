// Invoice lines from a request body, checked and shaped for the database.

import { round2 } from '@/lib/billing/pricing';
import { BillingInputError, requireMoney, requireText, MAX_LABEL } from '@/lib/billing/validate';

export type LineInput = {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
};

export const MAX_LINES = 50;

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
