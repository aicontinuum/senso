import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

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

  type GatewayRow = { id: string; is_online: boolean; decommissioned_at: string | null; sensors?: { id: string; decommissioned_at: string | null }[] };

  const rows = (customers ?? []).map(customer => {
    // Retired devices keep their readings but are not counted as live.
    const gateways = ((customer.gateways ?? []) as GatewayRow[]).filter(gw => gw.decommissioned_at === null);
    const sensorCount = gateways.reduce(
      (sum: number, gw) => sum + (gw.sensors ?? []).filter(s => s.decommissioned_at === null).length,
      0,
    );
    const anyOnline = gateways.some(gw => gw.is_online);
    const gwStatus = gateways.length === 0 ? 'none' : anyOnline ? 'online' : 'offline';
    return { customer, sensorCount, gwStatus };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <Link
          href="/customers/new"
          className="text-sm px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          + New Customer
        </Link>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Contact</th>
                <th className="px-6 py-3 font-medium">Sensors</th>
                <th className="px-6 py-3 font-medium">Gateway</th>
                <th className="px-6 py-3 font-medium">Date Added</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No customers yet. <Link href="/customers/new" className="underline">Add one.</Link>
                  </td>
                </tr>
              )}
              {rows.map(({ customer, sensorCount, gwStatus }) => (
                <tr key={customer.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{customer.contact_name ?? '—'}</td>
                  <td className="px-6 py-4 tabular-nums">{sensorCount}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${gwStatus === 'online' ? 'bg-green-500' : gwStatus === 'offline' ? 'bg-zinc-400' : 'bg-zinc-300'}`} />
                      <span className={gwStatus === 'online' ? 'text-green-700' : 'text-muted-foreground'}>
                        {gwStatus === 'online' ? 'Online' : gwStatus === 'offline' ? 'Offline' : '—'}
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(customer.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        View
                      </Link>
                      <button className="text-sm text-red-500 hover:text-red-700 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
