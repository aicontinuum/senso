import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadGroupOfEveryone } from '@/lib/groups/load';
import { CustomersTable, type CustomerListRow } from '@/components/customers/CustomersTable';
import { GroupsTable, type GroupListRow } from '@/components/customers/GroupsTable';

// Two lists: owner logins first, when there are any, then the accounts
// that own devices. Both kinds are created from the buttons at the top.

type GatewayRow = {
  id: string;
  is_online: boolean;
  decommissioned_at: string | null;
  sensors?: { id: string; decommissioned_at: string | null }[];
};

export default async function CustomersPage() {
  const supabase = createAdminClient();

  const [{ data: customers }, groupOf] = await Promise.all([
    supabase
      .from('customers')
      .select(`
        id,
        name,
        email,
        contact_name,
        created_at,
        is_group,
        gateways (
          id,
          is_online,
          decommissioned_at,
          sensors (id, decommissioned_at)
        )
      `)
      .order('created_at', { ascending: false }),
    loadGroupOfEveryone(supabase),
  ]);

  const memberCount = new Map<string, number>();
  for (const group of groupOf.values()) memberCount.set(group.id, (memberCount.get(group.id) ?? 0) + 1);

  const groups: GroupListRow[] = (customers ?? [])
    .filter(c => c.is_group)
    .map(c => ({ id: c.id, name: c.name, email: c.email, contact_name: c.contact_name, created_at: c.created_at, memberCount: memberCount.get(c.id) ?? 0 }));

  const rows: CustomerListRow[] = (customers ?? [])
    .filter(c => !c.is_group)
    .map(customer => {
      // Retired devices keep their readings but are not counted as live.
      const gateways = ((customer.gateways ?? []) as GatewayRow[]).filter(gw => gw.decommissioned_at === null);
      const sensorCount = gateways.reduce(
        (sum: number, gw) => sum + (gw.sensors ?? []).filter(s => s.decommissioned_at === null).length,
        0,
      );
      const anyOnline = gateways.some(gw => gw.is_online);
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        contact_name: customer.contact_name,
        created_at: customer.created_at,
        sensorCount,
        gwStatus: gateways.length === 0 ? 'none' : anyOnline ? 'online' : 'offline',
        groupOf: groupOf.get(customer.id) ?? null,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/customers/new-group">
              <Users className="size-4" />
              New group account
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/customers/new">
              <Plus className="size-4" />
              New customer
            </Link>
          </Button>
        </div>
      </div>

      {groups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Groups</h2>
          <GroupsTable rows={groups} />
        </section>
      )}

      <section className="space-y-3">
        {groups.length > 0 && <h2 className="text-lg font-semibold tracking-tight">Customers</h2>}
        <CustomersTable rows={rows} />
      </section>
    </div>
  );
}
