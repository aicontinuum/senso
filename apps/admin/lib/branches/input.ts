// Branch fields from a request body, checked the same way billing input is.

import { RECIPIENTS_MESSAGES, validateRecipients } from '@senso/recipients';
import { BillingInputError, MAX_LABEL, MAX_TEXT, optionalText, requireText } from '@/lib/billing/validate';

export const MAX_BRANCH_NAME = MAX_LABEL;
export const MAX_BRANCH_ADDRESS = MAX_TEXT;

export type BranchInput = { name: string; address: string | null; alertRecipients: string[] };

/** Recipients are the addresses the alert job sends to, so the list is
 *  checked with the same rules the customer app applies, and the normalised
 *  result is what gets stored. Absent means none of its own. */
export function parseBranchInput(body: Record<string, unknown>): BranchInput {
  const recipients = validateRecipients(body.alertRecipients ?? []);
  if (!recipients.ok) throw new BillingInputError(RECIPIENTS_MESSAGES[recipients.error]);
  return {
    name: requireText(body.name, 'name', MAX_BRANCH_NAME),
    address: optionalText(body.address, 'address', MAX_BRANCH_ADDRESS),
    alertRecipients: recipients.value,
  };
}

/** Postgres refuses two branches of one customer with the same name
 *  (unique_violation, 23505). Everything else is unexpected. */
export const DUPLICATE_NAME_CODE = '23505';
export const DUPLICATE_NAME_MESSAGE = 'This customer already has a branch with that name';
