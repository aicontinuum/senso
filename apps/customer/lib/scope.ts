import type { SupabaseClient } from '@supabase/supabase-js';
import { SUSPENDED, type CustomerRecord } from '@/lib/supabase/get-customer';
import { loadBranches } from '@/lib/branches';

// What a login can see, and how the pages group it. An ordinary account
// sees itself, grouped by branch. A group (an owner login) sees its member
// accounts, grouped by member, and changes nothing in them: the database
// refuses every write, and the pages hide the controls to match.
//
// "Site" is the word for whichever grouping applies, so one dashboard, one
// alerts list and one report picker serve both kinds of login.

export type Site = {
  id: string;
  name: string;
  /** Printed on this site's reports, when known. */
  address: string | null;
};

export type ViewScope = {
  /** The accounts whose devices this login reads: itself, or its members. */
  customerIds: string[];
  isGroup: boolean;
  /** Every write is refused for a group; the pages hide the controls. */
  readOnly: boolean;
  /** Members for a group, branches otherwise. */
  sites: Site[];
  /** Members that are suspended: named on the dashboard, their data never
   *  loaded. Empty for an ordinary login. */
  suspendedSites: Site[];
  /** Which gateway column a site is keyed by. */
  siteKey: 'customer_id' | 'branch_id';
};

type MemberRow = { member_id: string; customers: { id: string; name: string; status: string } | null };

export async function loadScope(supabase: SupabaseClient, customer: CustomerRecord): Promise<ViewScope> {
  if (!customer.is_group) {
    const branches = await loadBranches(supabase, customer.id);
    return {
      customerIds: [customer.id],
      isGroup: false,
      readOnly: false,
      sites: branches.map((b) => ({ id: b.id, name: b.name, address: b.address })),
      suspendedSites: [],
      siteKey: 'branch_id',
    };
  }

  const { data, error } = await supabase
    .from('customer_group_members')
    .select('member_id, customers!customer_group_members_member_id_fkey (id, name, status)')
    .eq('group_id', customer.id);
  if (error) throw new Error(`customer_group_members: ${error.message}`);
  const all = (data as unknown as MemberRow[]).flatMap((r) => (r.customers ? [r.customers] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  // A suspended member is withheld from its owner too: named, nothing more.
  const members = all.filter((m) => m.status !== SUSPENDED);
  const suspended = all.filter((m) => m.status === SUSPENDED);
  const memberIds = members.map((m) => m.id);

  // A member's address is the one on its first branch, the one created with
  // the account; a member with several branches is one site to the owner.
  const { data: branchRows, error: branchesError } = memberIds.length > 0
    ? await supabase.from('branches').select('customer_id, address').in('customer_id', memberIds).order('created_at')
    : { data: [], error: null };
  if (branchesError) throw new Error(`branches: ${branchesError.message}`);
  const addressOf = new Map<string, string | null>();
  for (const b of branchRows ?? []) if (!addressOf.has(b.customer_id)) addressOf.set(b.customer_id, b.address);

  return {
    customerIds: memberIds,
    isGroup: true,
    readOnly: true,
    sites: members.map((m) => ({ id: m.id, name: m.name, address: addressOf.get(m.id) ?? null })),
    suspendedSites: suspended.map((m) => ({ id: m.id, name: m.name, address: null })),
    siteKey: 'customer_id',
  };
}

/** Whether a gateway's account is one this login may read. RLS already
 *  refuses the rows; this turns "nothing came back" into a clear 404. */
export function canView(scope: ViewScope, customerId: string): boolean {
  return scope.customerIds.includes(customerId);
}

/** The site a gateway belongs to, by the scope's key. */
export function siteOfGateway(scope: ViewScope, gateway: { customer_id: string; branch_id: string }): string {
  return gateway[scope.siteKey];
}
