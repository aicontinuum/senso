// Input checks for the billing routes. Allowlists throughout: an enum is one
// of its values or it is rejected, a date is YYYY-MM-DD or it is rejected, and
// money is a finite number with at most two decimals. Each returns the parsed
// value or throws a BillingInputError the route turns into a 400.

import type { BillingTier, DiscountType, InvoiceType, PaymentMethod, TermMonths } from '@/types/billing';

export class BillingInputError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIERS: readonly BillingTier[] = ['starter', 'standard', 'custom'];
const INVOICE_TYPES: readonly InvoiceType[] = ['onboarding', 'renewal', 'adjustment'];
const DISCOUNT_TYPES: readonly DiscountType[] = ['amount', 'percent'];
const PAYMENT_METHODS: readonly PaymentMethod[] = ['bank_transfer', 'cash', 'cheque'];
export const MAX_TEXT = 2000;
export const MAX_LABEL = 120;

export function requireDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new BillingInputError(`${field} must be a date (YYYY-MM-DD)`);
  }
  return value;
}

export function optionalDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireDate(value, field);
}

export function requireMoney(value: unknown, field: string, { min = 0 }: { min?: number } = {}): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || Math.round(n * 100) !== n * 100) {
    throw new BillingInputError(`${field} must be an amount${min > 0 ? ` of at least ${min}` : ''}`);
  }
  return n;
}

export function requireCount(value: unknown, field: string): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new BillingInputError(`${field} must be a whole number`);
  }
  return n;
}

export function requireText(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new BillingInputError(`${field} is required`);
  }
  return value.trim();
}

export function optionalText(value: unknown, field: string, max = MAX_TEXT): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > max) throw new BillingInputError(`${field} is too long`);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new BillingInputError(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export const requireTier = (v: unknown) => oneOf(TIERS, v, 'tier');
export const requireInvoiceType = (v: unknown) => oneOf(INVOICE_TYPES, v, 'type');
export const requirePaymentMethod = (v: unknown) => oneOf(PAYMENT_METHODS, v, 'method');

export function optionalDiscountType(v: unknown): DiscountType | null {
  if (v === null || v === undefined || v === '') return null;
  return oneOf(DISCOUNT_TYPES, v, 'discount type');
}

export function requireTermMonths(value: unknown): TermMonths {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (n !== 6 && n !== 12) throw new BillingInputError('term must be 6 or 12 months');
  return n;
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new BillingInputError(`${field} is invalid`);
  return value;
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireUuid(value, field);
}
