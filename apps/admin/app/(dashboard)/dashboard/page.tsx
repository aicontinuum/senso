import Link from 'next/link';
import {
  mockCustomers,
  mockSensors,
  mockAlerts,
} from '@senso/mock-data';
import type { Customer } from '@senso/types';

const STATUS_COLORS: Record<string, string> = {
  active:    'text-green-600',
  overdue:   'text-amber-600',
  suspended: 'text-red-600',
};

const STATUS_DOT: Record<string, string> = {
  active:    'bg-green-500',
  overdue:   'bg-amber-500',
  suspended: 'bg-red-500',
};

function billingLabel(status: Customer['billingStatus']) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminDashboardPage() {
  const sensorsOnline  = mockSensors.filter(s => s.status === 'online').length;
  const sensorsOffline = mockSensors.filter(s => s.status === 'offline').length;
  const activeAlerts   = mockAlerts.filter(a => !a.resolvedAt).length;

  const activeCount    = mockCustomers.filter(c => c.billingStatus === 'active').length;
  const overdueCount   = mockCustomers.filter(c => c.billingStatus === 'overdue').length;
  const suspendedCount = mockCustomers.filter(c => c.billingStatus === 'suspended').length;

  const rows = mockCustomers.map(customer => {
    const sensorCount   = mockSensors.filter(s => s.customerId === customer.id).length;
    const alertCount    = mockAlerts.filter(
      a => !a.resolvedAt && mockSensors.find(s => s.id === a.sensorId)?.customerId === customer.id,
    ).length;
    return { customer, sensorCount, alertCount };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-muted-foreground">Customers</p>
          <p className="mt-1 text-3xl font-bold">{mockCustomers.length}</p>
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            <p><span className="font-medium text-green-600">{activeCount}</span> active</p>
            {overdueCount > 0 && (
              <p><span className="font-medium text-amber-600">{overdueCount}</span> overdue</p>
            )}
            {suspendedCount > 0 && (
              <p><span className="font-medium text-red-600">{suspendedCount}</span> suspended</p>
            )}
          </div>
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
          <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
          <p className={`mt-1 text-3xl font-bold ${activeAlerts > 0 ? 'text-red-600' : ''}`}>
            {activeAlerts}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">unresolved</p>
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
                <th className="px-6 py-3 font-medium">Billing</th>
                <th className="px-6 py-3 font-medium">Sensors</th>
                <th className="px-6 py-3 font-medium">Active Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ customer, sensorCount, alertCount }) => (
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
                    <span className={`flex items-center gap-1.5 font-medium ${STATUS_COLORS[customer.billingStatus]}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[customer.billingStatus]}`} />
                      {billingLabel(customer.billingStatus)}
                    </span>
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
