// Validation for alert-email recipient lists.
//
// These arrays are the addresses the system will actually send to, so they are
// validated server-side on every write. Before alerting existed this was a
// data-quality concern; now an unvalidated array is a way to make our domain
// send mail to addresses of someone else's choosing, which would burn the
// sending reputation the alerts depend on.

export const MAX_RECIPIENTS = 10;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321 limit on a forward path.

// Deliberately conservative: one @, no whitespace, a dot-separated domain, and
// no display names or angle brackets. Anything exotic but legal is rejected in
// favour of never accepting something a mail header could misread.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>".]+(\.[^\s@,;<>".]+)+$/;

export type RecipientsError =
  | "not-a-list"
  | "too-many"
  | "invalid-email"
  | "duplicate";

export const RECIPIENTS_MESSAGES: Record<RecipientsError, string> = {
  "not-a-list": "Recipients must be a list of email addresses.",
  "too-many": `You can have at most ${MAX_RECIPIENTS} alert recipients.`,
  "invalid-email": "One of the addresses is not a valid email address.",
  duplicate: "That address is already in the list.",
};

export function normaliseRecipient(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidRecipient(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const email = normaliseRecipient(raw);
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

/**
 * Validates a whole list. Returns the normalised list, or the first problem —
 * callers must use the returned value rather than the input, so what is stored
 * is what was checked.
 */
export function validateRecipients(
  raw: unknown,
): { ok: true; value: string[] } | { ok: false; error: RecipientsError } {
  if (!Array.isArray(raw)) return { ok: false, error: "not-a-list" };
  if (raw.length > MAX_RECIPIENTS) return { ok: false, error: "too-many" };

  const seen = new Set<string>();
  const value: string[] = [];
  for (const entry of raw) {
    if (!isValidRecipient(entry)) return { ok: false, error: "invalid-email" };
    const email = normaliseRecipient(entry);
    // Case-insensitive, so one address cannot be added twice and be emailed twice.
    if (seen.has(email)) return { ok: false, error: "duplicate" };
    seen.add(email);
    value.push(email);
  }
  return { ok: true, value };
}
