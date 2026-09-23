// A customer's locations (supabase/migrations/20260925_branches.sql). A
// branch groups gateways; it is not a security boundary.

export type BranchRow = {
  id: string;
  customer_id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Branch = {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  createdAt: string;
};

export const BRANCH_COLUMNS = 'id, customer_id, name, address, created_at';

export function toBranch(row: BranchRow): Branch {
  return { id: row.id, customerId: row.customer_id, name: row.name, address: row.address, createdAt: row.created_at };
}
