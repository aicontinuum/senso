// Groups on the admin side (supabase/migrations/20260927_groups.sql): an
// owner login that reads its members. The database holds the rules; these
// loaders only read the membership table from the customer's point of view.

import type { createAdminClient } from '@/lib/supabase/admin';
import { GATEWAY_SUMMARY_SELECT, summariseDevices, type DeviceSummary, type GatewaySummaryRow } from '@/lib/customers/device-summary';

type Admin = ReturnType<typeof createAdminClient>;

export type AccountRef = { id: string; name: string; email: string };
/** A member as its row on the group's page shows it: who, and how its
 *  devices are doing. */
export type GroupMember = AccountRef & DeviceSummary;
export type GroupRef = { id: string; name: string };

type MemberRow = { member_id: string; customers: (AccountRef & { gateways: GatewaySummaryRow[] | null }) | null };
type GroupRow = { group_id: string; customers: { id: string; name: string } | null };

/** The accounts an owner login reads, by name, with their device health. */
export async function loadGroupMembers(admin: Admin, groupId: string): Promise<GroupMember[]> {
  const { data, error } = await admin
    .from('customer_group_members')
    .select(`member_id, customers!customer_group_members_member_id_fkey (id, name, email, ${GATEWAY_SUMMARY_SELECT})`)
    .eq('group_id', groupId)
    .order('created_at');
  if (error) throw new Error(`customer_group_members: ${error.message}`);
  return (data as unknown as MemberRow[]).flatMap(r =>
    r.customers ? [{ id: r.customers.id, name: r.customers.name, email: r.customers.email, ...summariseDevices(r.customers.gateways) }] : [],
  );
}

/** The group an account belongs to, if any. */
export async function loadGroupOf(admin: Admin, memberId: string): Promise<GroupRef | null> {
  const { data, error } = await admin
    .from('customer_group_members')
    .select('group_id, customers!customer_group_members_group_id_fkey (id, name)')
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw new Error(`customer_group_members: ${error.message}`);
  return (data as unknown as GroupRow | null)?.customers ?? null;
}

/** Every membership at once, for the customers list. */
export async function loadGroupOfEveryone(admin: Admin): Promise<Map<string, GroupRef>> {
  const { data, error } = await admin
    .from('customer_group_members')
    .select('member_id, customers!customer_group_members_group_id_fkey (id, name)');
  if (error) throw new Error(`customer_group_members: ${error.message}`);
  const out = new Map<string, GroupRef>();
  for (const r of data as unknown as (GroupRow & { member_id: string })[]) {
    if (r.customers) out.set(r.member_id, r.customers);
  }
  return out;
}

/** Accounts that could join a group: not a group themselves, not already
 *  in one. What the Add picker offers. */
export async function loadUnlinkedAccounts(admin: Admin): Promise<AccountRef[]> {
  const [{ data: customers, error }, { data: linked, error: linkedError }] = await Promise.all([
    admin.from('customers').select('id, name, email').eq('is_group', false).order('name'),
    admin.from('customer_group_members').select('member_id'),
  ]);
  if (error) throw new Error(`customers: ${error.message}`);
  if (linkedError) throw new Error(`customer_group_members: ${linkedError.message}`);
  const taken = new Set((linked ?? []).map(r => r.member_id));
  return (customers ?? []).filter(c => !taken.has(c.id));
}
