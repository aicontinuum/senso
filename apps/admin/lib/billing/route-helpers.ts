// What every billing route does before and after its own work: prove the
// caller is an admin, parse the body, and turn a failure into a response
// that says only what the client needs. Detailed errors go to the server log.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BillingInputError } from '@/lib/billing/validate';

export type AdminContext = {
  admin: ReturnType<typeof createAdminClient>;
  actorId: string;
};

export type Denied = { response: NextResponse };

const ADMIN_ROLE = 'admin';

export async function requireAdmin(): Promise<AdminContext | Denied> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== ADMIN_ROLE) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { admin: createAdminClient(), actorId: user.id };
}

export function isDenied(ctx: AdminContext | Denied): ctx is Denied {
  return 'response' in ctx;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new BillingInputError('Request body must be a JSON object');
}

/** A thrown error from a route becomes 400 for bad input, 409 for a rule the
 *  database refused, 500 for anything else. Only bad-input messages reach the
 *  client verbatim; the rest is logged with the route's label. */
export function failureResponse(label: string, error: unknown): NextResponse {
  if (error instanceof BillingInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof BillingRuleError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error(`[api] ${label} failed`, error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

/** A rule the database enforces (frozen invoice, paid cannot be voided…),
 *  reported in the words the migration raises. */
export class BillingRuleError extends Error {}

/** Postgres raises the billing rules as check_violation (23514). Anything
 *  else stays a 500. */
export function ruleOrThrow(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === '23514') throw new BillingRuleError(error.message.replace(/^.*?:\s*/, ''));
  throw new Error(`${error.code ?? ''} ${error.message}`);
}
