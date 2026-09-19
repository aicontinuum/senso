// Display formatting shared by the admin pages. Dates print British-style
// ("19 Sep 2026") because that is what the ops staff read; money prints in
// the pricing currency from SENSO.md with no decimals unless there are some.

export const CURRENCY = 'QAR';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso);
  return Number.isFinite(t.getTime()) ? dateFormatter.format(t) : '—';
}

const moneyFormatter = new Intl.NumberFormat('en-QA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "QAR 4,950" — the code before the number, as invoices in Qatar print it. */
export function formatMoney(amount: number): string {
  return `${CURRENCY} ${moneyFormatter.format(amount)}`;
}

/** Postgres numeric arrives as a string; a missing value counts as zero. */
export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as a date-only ISO string, in UTC to match Postgres' current_date. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** A date-only ISO string moved by whole days. */
export function plusDays(dateIso: string, days: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from today to a date-only ISO string; negative once it has passed. */
export function daysUntil(dateIso: string, now: number = Date.now()): number {
  const target = Date.parse(`${dateIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso(now)}T00:00:00Z`);
  return Math.round((target - today) / DAY_MS);
}

/** "in 12 days", "today", "3 days ago" — for due and renewal dates. */
export function formatDaysRelative(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
