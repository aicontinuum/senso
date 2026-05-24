import Link from 'next/link';
import {
  mockCustomers,
  mockGateways,
  mockSensors,
  mockAlerts,
} from '@senso/mock-data';


const MOCK_NOW = new Date('2025-05-22T03:00:00.000Z').getTime();
const cutoff24h = MOCK_NOW - 24 * 60 * 60 * 1000;

export default function AdminDashboardPage() {
  const sensorsOnline  = mockSensors.filter(s => s.status === 'online').length;
  const sensorsOffline = mockSensors.filter(s => s.status === 'offline').length;
  const recentAlerts   = mockAlerts.filter(a => new Date(a.triggeredAt).getTime() >= cutoff24h).length;

  const rows = mockCustomers.map(customer => {
    const gateways    = mockGateways.filter(g => g.customerId === customer.id);
    const sensorCount = mockSensors.filter(s => s.customerId === customer.id).length;
    const sensorIds   = new Set(mockSensors.filter(s => s.customerId === customer.id).map(s => s.id));
    const alertCount  = mockAlerts.filter(
      a => new Date(a.triggeredAt).getTime() >= cutoff24h && sensorIds.has(a.sensorId),
    ).length;
    return { customer, gateways, sensorCount, alertCount };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Customers</p>
          <p className="mt-1 text-3xl font-bold">{mockCustomers.length}</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Sensors</p>
          <p className="mt-1 text-3xl font-bold">{mockSensors.length}</p>
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <p><span className="font-medium text-green-600">{sensorsOnline}</span> online</p>
            <p><span className="font-medium text-red-600">{sensorsOffline}</span> offline</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Alerts (past 24h)</p>
          <p className={`mt-1 text-3xl font-bold ${recentAlerts > 0 ? 'text-red-600' : ''}`}>
            {recentAlerts}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">across all customers</p>
        </div>
      </div>

      {/* Customers table */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Customers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Gateway</th>
                <th className="px-6 py-3 font-medium">Sensors</th>
                <th className="px-6 py-3 font-medium">Alerts (past 24h)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ customer, gateways, sensorCount, alertCount }) => (
                <tr key={customer.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{customer.contactEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    {gateways.map(g => (
                      <span key={g.id} className="flex items-center gap-1.5 text-sm">
                        <span className={`inline-block h-2 w-2 rounded-full ${g.status === 'online' ? 'bg-green-500' : 'bg-zinc-400'}`} />
                        {g.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    ))}
                    {gateways.length === 0 && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-4 tabular-nums">{sensorCount}</td>
                  <td className="px-6 py-4 tabular-nums">
                    {alertCount > 0 ? (
                      <span className="font-medium text-red-600">{alertCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
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
