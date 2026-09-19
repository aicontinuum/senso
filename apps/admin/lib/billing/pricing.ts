// The arithmetic behind every proposed figure. Pure functions of the settings
// row and the plan's shape, so the same numbers appear in the form, in the
// API's response and in a test. Nothing here is enforced: the admin can type
// over any of it, and the stored value is what gets invoiced.

import type { BillingSettings, BillingTier, TermMonths } from '@/types/billing';

/** Sensor ranges from the price list: 1–3 Starter, 4–8 Standard, 9+ Custom. */
export const STARTER_MAX_SENSORS = 3;
export const STANDARD_MAX_SENSORS = 8;

export function suggestTier(sensorCount: number): BillingTier {
  if (sensorCount <= STARTER_MAX_SENSORS) return 'starter';
  if (sensorCount <= STANDARD_MAX_SENSORS) return 'standard';
  return 'custom';
}

/** The list monthly rate for a tier; Custom has none and is typed by hand. */
export function listMonthlyRate(settings: BillingSettings, tier: BillingTier): number | null {
  switch (tier) {
    case 'starter': return settings.starterMonthly;
    case 'standard': return settings.standardMonthly;
    case 'custom': return null;
  }
}

export function listAddonRate(settings: BillingSettings, tier: BillingTier): number {
  return tier === 'custom' ? settings.addonMonthlyCustom : settings.addonMonthly;
}

export type Proposal = {
  monthlyRate: number | null;
  addonMonthlyRate: number;
  /** (monthly + addons × addon rate) × term months; null when monthly is.
   *  Any term discount is the admin's, applied on the invoice. */
  termTotal: number | null;
};

export function proposeSubscription(
  settings: BillingSettings,
  tier: BillingTier,
  addonCount: number,
  termMonths: TermMonths,
): Proposal {
  const monthlyRate = listMonthlyRate(settings, tier);
  const addonMonthlyRate = listAddonRate(settings, tier);
  return {
    monthlyRate,
    addonMonthlyRate,
    termTotal: monthlyRate === null ? null : round2((monthlyRate + addonCount * addonMonthlyRate) * termMonths),
  };
}

/** The monthly figure actually paid, for the plan block and the ARR line. */
export function effectiveMonthly(monthlyRate: number, addonCount: number, addonMonthlyRate: number): number {
  return round2(monthlyRate + addonCount * addonMonthlyRate);
}

/** Anniversary billing: the renewal is one term after the start. */
export function renewalDateFor(termStart: string, termMonths: TermMonths): string {
  const [y, m, d] = termStart.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + termMonths, d));
  // Feb 30 → Mar 2 would be wrong; clamp to the last day of the target month.
  if (date.getUTCDate() !== d) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

/** Whole months from a date to the renewal, never negative. */
export function wholeMonthsRemaining(fromIso: string, renewalIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ry, rm, rd] = renewalIso.split('-').map(Number);
  let months = (ry - fy) * 12 + (rm - fm);
  if (rd < fd) months -= 1;
  return Math.max(0, months);
}

/**
 * A mid-term change is charged (or credited) as the monthly difference for
 * the whole months left in the term. Zero when nothing moved.
 */
export function midTermAdjustment(oldMonthly: number, newMonthly: number, monthsRemaining: number): number {
  return round2((newMonthly - oldMonthly) * monthsRemaining);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** What is still owed on an invoice: total less payments, never below zero. */
export function balanceOf(invoice: { total: number; paid: number }): number {
  return round2(Math.max(0, invoice.total - invoice.paid));
}
