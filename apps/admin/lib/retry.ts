// Retry for the calls that gate a job.
//
// The path from Vercel to Supabase's API drops requests now and then — on the
// night of 2026-09-11 about four runs in ten of the sender lost either its
// status read or its claim. Detection no longer crosses that path (it lives in
// Postgres), so a dropped request only delays an email; but three drops in a
// row trips the watchdog, and at that rate it happens several times a night.
//
// Three attempts with a short pause turns a 40 % drop rate into a fraction of a
// percent for the run as a whole. Only used on calls that are safe to repeat:
// reads, and the claim/mark/release functions, which are idempotent by design.

import { setTimeout as sleep } from 'node:timers/promises';

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 400;

type WithError = { error: { message?: string; code?: string } | null };

/**
 * Runs `attempt` until it returns without an error or the attempts run out,
 * and returns the last result either way. `attempt` must build a fresh request
 * each time it is called — a Supabase query builder cannot be awaited twice.
 */
export async function retry<T extends WithError>(
  label: string,
  attempt: () => PromiseLike<T>,
): Promise<T & { attempts: number }> {
  let last: T | undefined;
  for (let n = 1; n <= RETRY_ATTEMPTS; n++) {
    last = await attempt();
    if (!last.error) return { ...last, attempts: n };
    if (n < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS * n);
  }
  console.error(`[retry] ${label} failed after ${RETRY_ATTEMPTS} attempts`, last!.error);
  return { ...(last as T), attempts: RETRY_ATTEMPTS };
}

/** The short form of an error for a ledger row: code and message, nothing else. */
export function describeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'unknown';
  return [error.code, error.message].filter(Boolean).join(': ') || 'unknown';
}
