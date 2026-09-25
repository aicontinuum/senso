import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, Card, LinkRow } from '@senso/ui';
import { formatDate } from '@/lib/format';
import { LIST_TD, LIST_TH } from '@/components/customers/CustomersTable';

// Owner logins, one row each, with how many accounts each can see.

export type GroupListRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  created_at: string;
  memberCount: number;
};

export function GroupsTable({ rows }: { rows: GroupListRow[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-muted-foreground">
            <th className={LIST_TH}>Group</th>
            <th className={LIST_TH}>Contact</th>
            <th className={LIST_TH}>Members</th>
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
                <td className={`${LIST_TD} tabular-nums`}>{row.memberCount}</td>
                <td className={`${LIST_TD} whitespace-nowrap text-muted-foreground`}>{formatDate(row.created_at)}</td>
                <td className={`${LIST_TD} text-right`}>
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
