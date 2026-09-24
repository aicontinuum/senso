import type { SupabaseClient } from '@supabase/supabase-js';

// A customer's branches on the customer site. Read-only here: admin creates
// and names them. A customer with one branch never sees the word; every
// page checks `hasBranches()` before drawing a heading or a filter.

export type BranchOption = {
  id: string;
  name: string;
  /** Printed on this branch's reports. */
  address: string | null;
  /** Empty means the account list is used for this branch's alerts. */
  alertRecipients: string[];
};

/** The query-string key a page uses to show one branch. */
export const BRANCH_PARAM = 'branch';
/** The value, and the default, that means every branch. */
export const ALL_BRANCHES = 'all';

export async function loadBranches(supabase: SupabaseClient, customerId: string): Promise<BranchOption[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, alert_recipients')
    .eq('customer_id', customerId)
    .order('created_at');
  if (error) throw new Error(`branches: ${error.message}`);
  return (data ?? []).map((b) => ({ id: b.id, name: b.name, address: b.address, alertRecipients: b.alert_recipients ?? [] }));
}

/** Branch UI exists only once there is something to choose between. */
export function hasBranches(branches: BranchOption[]): boolean {
  return branches.length > 1;
}

/** The branch a page should show, from its query string: a real branch id,
 *  or all of them. An unknown id falls back to all rather than to nothing. */
export function selectedBranch(param: string | string[] | undefined, branches: BranchOption[]): string {
  const value = Array.isArray(param) ? param[0] : param;
  return value && branches.some(b => b.id === value) ? value : ALL_BRANCHES;
}

/** The addresses a branch's alerts go to: its own list, or the account's. */
export function effectiveRecipients(branch: BranchOption | undefined, accountRecipients: string[]): string[] {
  return branch && branch.alertRecipients.length > 0 ? branch.alertRecipients : accountRecipients;
}

/** Items in branch order, each branch with its own items, empty branches
 *  included so a site with nothing installed yet still has a heading. */
export function groupByBranch<T>(branches: BranchOption[], items: T[], branchOf: (item: T) => string): { branch: BranchOption; items: T[] }[] {
  return branches.map(branch => ({ branch, items: items.filter(item => branchOf(item) === branch.id) }));
}
