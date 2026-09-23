import type { createAdminClient } from '@/lib/supabase/admin';
import { BRANCH_COLUMNS, toBranch, type Branch, type BranchRow } from '@/types/branches';

type Admin = ReturnType<typeof createAdminClient>;

/** A customer's branches, oldest first, so the one created with the
 *  customer stays at the top. */
export async function loadBranches(admin: Admin, customerId: string): Promise<Branch[]> {
  const { data, error } = await admin
    .from('branches')
    .select(BRANCH_COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at');
  if (error) throw new Error(`branches: ${error.message}`);
  return (data as unknown as BranchRow[]).map(toBranch);
}

/** One branch, only if it belongs to the customer. A branch id from another
 *  customer is simply not found. */
export async function findCustomerBranch(admin: Admin, customerId: string, branchId: string): Promise<Branch | null> {
  const { data, error } = await admin
    .from('branches')
    .select(BRANCH_COLUMNS)
    .eq('customer_id', customerId)
    .eq('id', branchId)
    .maybeSingle();
  if (error) throw new Error(`branches: ${error.message}`);
  return data ? toBranch(data as unknown as BranchRow) : null;
}
