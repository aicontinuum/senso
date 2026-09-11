import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge, Button, Card } from '@senso/ui';
import { LinkRow } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type GatewayRow = {
  id: string;
  is_online: boolean;
  decommissioned_at: string | null;
  sensors?: { id: string; decommissioned_at: string | null }[];
};

type GatewayStatus = 'none' | 'online' | 'offline';

const TH = 'px-6 py-3 font-medium';
const TD = 'px-6 py-4';

export default async function CustomersPage() {
  const supabase = createAdminClient();

  const { data: customers } = await supabase
    .from('customers')
    .select(`
      id,
      name,
      email,
      contact_name,
      created_at,
      gateways (
        id,
        is_online,
        decommissioned_at,
        sensors (id, decommissioned_at)
      )
    `)
    .order('created_at', { ascending: false });

  const rows = (customers ?? []).map(customer => {
    // Retired devices keep their readings but are not counted as live.
    const gateways = ((customer.gateways ?? []) as GatewayRow[]).filter(gw => gw.decommissioned_at === null);
    const sensorCount = gateways.reduce(
      (sum: number, gw) => sum + (gw.sensors ?? []).filter(s => s.decommissioned_at === null).length,
      0,
    );
    const anyOnline = gateways.some(gw => gw.is_online);
    const gwStatus: GatewayStatus = gateways.length === 0 ? 'none' : anyOnline ? 'online' : 'offline';
    return { customer, sensorCount, gwStatus };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <Button asChild size="sm">
          <Link href="/customers/new">
            <Plus className="size-4" />
            New customer
          </Link>
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-muted-foreground">
              <th className={TH}>Customer</th>
              <th className={TH}>Contact</th>
              <th className={TH}>Sensors</th>
              <th className={TH}>Gateway</th>
              <th className={`${TH} whitespace-nowrap`}>Date added</th>
              <th className={`${TH} relative`}><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  No customers yet. <Link href="/customers/new" className="underline">Add one.</Link>
                </td>
              </tr>
            )}
            {rows.map(({ customer, sensorCount, gwStatus }) => {
              const href = `/customers/${customer.id}`;
              return (
                <LinkRow key={customer.id} href={href}>
                  <td className={TD}>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </td>
                  <td className={`${TD} text-muted-foreground`}>{customer.contact_name ?? '—'}</td>
                  <td className={`${TD} tabular-nums`}>{sensorCount}</td>
                  <td className={TD}>
                    {gwStatus === 'none'
                      ? <span className="text-muted-foreground">—</span>
                      : (
                        <Badge variant={gwStatus === 'online' ? 'ok' : 'offline'} dot>
                          {gwStatus === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                      )}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{formatDate(customer.created_at)}</td>
                  <td className={`${TD} text-right`}>
                    {/* The row itself navigates; this is the visible affordance
                        and the keyboard route to the same place. */}
                    <Button asChild variant="secondary" size="sm">
                      <Link href={href}>
                        View
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </td>
                </LinkRow>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
