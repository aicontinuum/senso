import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Badge, Button, Card, LinkRow, StatusDot } from '@senso/ui';
import { formatDate } from '@/lib/format';
import type { GroupRef } from '@/lib/groups/load';

// The accounts that own devices, one row each, in two forms of the same
// data: a six-column table from desktop width up, and a stacked list below
// it, where a table would only scroll sideways. Membership of a group is a
// chip after the name in both. Rows arrive shaped by the page; this only
// draws them.

export type CustomerListRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  created_at: string;
  sensorCount: number;
  gwStatus: 'none' | 'online' | 'offline';
  groupOf: GroupRef | null;
};

export const LIST_TH = 'px-6 py-3 font-medium';
export const LIST_TD = 'px-6 py-4';
/** A phone row: the same press feel as every other list in the app. */
export const LIST_ROW = 'flex items-center gap-3 px-4 py-3.5 transition-colors duration-[--dur-fast] hover:bg-sunken active:bg-inset';

/** Which group an account is in, as a chip that reads at a glance. */
export function GroupChip({ group }: { group: GroupRef }) {
  return <Badge variant="outline" className="text-muted-foreground">{group.name}</Badge>;
}

// The gateway's state as a dot before the name, on the phone, where the
// table's badge column has no room. No gateway is no dot, only its space,
// so the names line up: grey would read as offline, and there is nothing
// to be offline.
function GatewayDot({ status }: { status: CustomerListRow['gwStatus'] }) {
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.name}</p>
                    {row.groupOf && <GroupChip group={row.groupOf} />}
                  </div>
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
          the left, with the group chip under the name; the sensor count on
          the right. Contact, email and date wait on the customer's page. */}
      <ul className="divide-y divide-hairline lg:hidden">
        {rows.map(row => (
          <li key={row.id}>
            <Link href={`/customers/${row.id}`} className={LIST_ROW}>
              <GatewayDot status={row.gwStatus} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                {row.groupOf && <div className="mt-1"><GroupChip group={row.groupOf} /></div>}
              </div>
              <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {row.gwStatus === 'none' ? 'No gateway' : `${row.sensorCount} ${row.sensorCount === 1 ? 'sensor' : 'sensors'}`}
              </p>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
