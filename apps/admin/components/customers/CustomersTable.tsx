import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Badge, Button, Card, LinkRow, StatusDot } from '@senso/ui';
import { formatDate } from '@/lib/format';
import type { DeviceSummary, GatewayStatus } from '@/lib/customers/device-summary';

// The accounts that own devices, one row each, in two forms of the same
// data: a six-column table from desktop width up, and a stacked list below
// it, where a table would only scroll sideways. Which group an account is
// in is not shown here: the Groups card above lists the groups, and the
// account's own page names its group. Rows arrive shaped by the page; this
// only draws them.

export type CustomerListRow = DeviceSummary & {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  created_at: string;
};

export const LIST_TH = 'px-6 py-3 font-medium';
export const LIST_TD = 'px-6 py-4';
/** A phone row: the same press feel as every other list in the app. */
export const LIST_ROW = 'flex items-center gap-3 px-4 py-3.5 transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset';

/** "6 sensors", or "No gateway" when there is nothing to count. */
export function sensorsLabel({ sensorCount, gwStatus }: DeviceSummary): string {
  if (gwStatus === 'none') return 'No gateway';
  return `${sensorCount} ${sensorCount === 1 ? 'sensor' : 'sensors'}`;
}

// The gateway's state as a dot before the name, on the phone and in any
// list without room for the table's badge column. No gateway is no dot,
// only its space, so the names line up: grey would read as offline, and
// there is nothing to be offline.
export function GatewayDot({ status }: { status: GatewayStatus }) {
  if (status === 'none') return <span className="size-2 shrink-0" aria-hidden />;
  const label = status === 'online' ? 'Gateway online' : 'Gateway offline';
  return (
    <span className="inline-flex shrink-0 items-center" title={label}>
      <StatusDot status={status === 'online' ? 'ok' : 'offline'} className="size-2" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function CustomersTable({ rows }: { rows: CustomerListRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No customers yet. <Link href="/customers/new" className="underline">Add one.</Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Desktop: the table. */}
      <table className="hidden w-full text-sm lg:table">
        <thead>
          <tr className="border-b border-hairline text-left text-muted-foreground">
            <th className={LIST_TH}>Customer</th>
            <th className={LIST_TH}>Contact</th>
            <th className={LIST_TH}>Sensors</th>
            <th className={LIST_TH}>Gateway</th>
            <th className={`${LIST_TH} whitespace-nowrap`}>Date added</th>
            <th className={`${LIST_TH} relative`}><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map(row => {
            const href = `/customers/${row.id}`;
            return (
              <LinkRow key={row.id} href={href}>
                <td className={LIST_TD}>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </td>
                <td className={`${LIST_TD} text-muted-foreground`}>{row.contact_name ?? '—'}</td>
                <td className={`${LIST_TD} tabular-nums`}>{row.sensorCount}</td>
                <td className={LIST_TD}>
                  {row.gwStatus === 'none'
                    ? <span className="text-muted-foreground">—</span>
                    : (
                      <Badge variant={row.gwStatus === 'online' ? 'ok' : 'offline'} dot>
                        {row.gwStatus === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    )}
                </td>
                <td className={`${LIST_TD} whitespace-nowrap text-muted-foreground`}>{formatDate(row.created_at)}</td>
                <td className={`${LIST_TD} text-right`}>
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

      {/* Phone: the same rows as a list. The gateway dot and the name on
          the left, the sensor count on the right. Contact, email and date
          wait on the customer's page. */}
      <ul className="divide-y divide-hairline lg:hidden">
        {rows.map(row => (
          <li key={row.id}>
            <Link href={`/customers/${row.id}`} className={LIST_ROW}>
              <GatewayDot status={row.gwStatus} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</p>
              <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{sensorsLabel(row)}</p>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
