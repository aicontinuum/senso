// Branch fields from a request body, checked the same way billing input is.

import { MAX_LABEL, MAX_TEXT, optionalText, requireText } from '@/lib/billing/validate';

export const MAX_BRANCH_NAME = MAX_LABEL;
export const MAX_BRANCH_ADDRESS = MAX_TEXT;

export type BranchInput = { name: string; address: string | null };

export function parseBranchInput(body: Record<string, unknown>): BranchInput {
  return {
    name: requireText(body.name, 'name', MAX_BRANCH_NAME),
    address: optionalText(body.address, 'address', MAX_BRANCH_ADDRESS),
  };
}

/** Postgres refuses two branches of one customer with the same name
 *  (unique_violation, 23505). Everything else is unexpected. */
export const DUPLICATE_NAME_CODE = '23505';
export const DUPLICATE_NAME_MESSAGE = 'This customer already has a branch with that name';
