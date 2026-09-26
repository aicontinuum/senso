import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { BillingStatus } from '@senso/types';
import { createClient } from './server';
import { DEFAULT_TIMEZONE } from '@/lib/timezones';

export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  phone: string | null;
  timezone: string;
  created_at: string;
  /** An owner login: reads its member accounts, owns no devices. */
  is_group: boolean;
  /** Set by admin. Suspended locks the app; readings and alerts continue. */
  status: BillingStatus;
};

export const SUSPENDED: BillingStatus = 'suspended';

export function isSuspended(customer: CustomerRecord): boolean {
  return customer.status === SUSPENDED;
}

export async function getCustomer(): Promise<CustomerRecord | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, contact_name, phone, timezone, created_at, is_group, status')
    .eq('auth_user_id', user.id)
    .single();
  if (!data) return null;
  return { ...data, timezone: data.timezone ?? DEFAULT_TIMEZONE };
}

// Like getCustomer(), but redirects to login (with an error param so the
// middleware won't bounce back into a loop) when no customer resolves.
export async function requireCustomer(): Promise<CustomerRecord> {
  const customer = await getCustomer();
  if (!customer) redirect('/login?error=session');
  return customer;
}

/** For the routes that change something. A suspended account is refused
 *  here as well as on screen, so a saved request cannot change thresholds
 *  or recipients while the app is locked. */
export async function requireActiveCustomer(): Promise<{ customer: CustomerRecord } | { response: NextResponse }> {
  const customer = await getCustomer();
  if (!customer) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (isSuspended(customer)) return { response: NextResponse.json({ error: 'This account is locked' }, { status: 403 }) };
  return { customer };
}
