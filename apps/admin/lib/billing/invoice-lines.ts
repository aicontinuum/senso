// Invoice lines from a request body, checked and shaped for the database.

import { round2 } from '@/lib/billing/pricing';
import { BillingInputError, requireMoney, requireText, MAX_LABEL } from '@/lib/billing/validate';

/** What the editor sends: a description, how many, and the line total. */
export type LineInput = {
  description: string;
  quantity: number;
  amount: number;
};

/** What is stored. The per-unit figure is not typed anywhere; it is kept on
 *  the row for the record, derived from the total and the quantity. */
export type StoredLine = LineInput & { unitAmount: number };

export const MAX_LINES = 50;

function unitAmountOf(quantity: number, amount: number): number {
  return quantity > 0 ? round2(amount / quantity) : amount;
}

/** Lines from a request body. `amount` is the stored figure. Negative amounts
 *  are allowed so a credit can appear on an adjustment. */
export function parseLines(value: unknown): StoredLine[] {
  if (!Array.isArray(value)) throw new BillingInputError('lines must be a list');
  if (value.length > MAX_LINES) throw new BillingInputError(`at most ${MAX_LINES} lines`);
  return value.map((raw, i) => {
    if (!raw || typeof raw !== 'object') throw new BillingInputError(`line ${i + 1} is invalid`);
    const line = raw as Record<string, unknown>;
    const quantity = requireMoney(line.quantity ?? 1, `line ${i + 1} quantity`);
    const amount = requireMoney(line.amount ?? 0, `line ${i + 1} amount`, { min: -1e9 });
    return {
      description: requireText(line.description, `line ${i + 1} description`, MAX_LABEL * 2),
      quantity, amount, unitAmount: unitAmountOf(quantity, amount),
    };
  });
}
