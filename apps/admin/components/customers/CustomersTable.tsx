import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, Card, LinkRow } from '@senso/ui';
import { formatDate } from '@/lib/format';
import type { GroupRef } from '@/lib/groups/load';

// The accounts that own devices, one row each. Rows arrive shaped by the
// page; this only draws them.

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

export function CustomersTable({ rows }: { rows: CustomerListRow[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                No customers yet. <Link href="/customers/new" className="underline">Add one.</Link>
              </td>
            </tr>
          )}
          {rows.map(row => {
            const href = `/customers/${row.id}`;
            return (
              <LinkRow key={row.id} href={href}>
                <td className={LIST_TD}>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.email}
                    {row.groupOf && <> · in {row.groupOf.name}</>}
                  </p>
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
    </Card>
  );
}
