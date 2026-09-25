import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button, Card, LinkRow } from '@senso/ui';
import { formatDate } from '@/lib/format';
import { LIST_ROW, LIST_TD, LIST_TH } from '@/components/customers/CustomersTable';

// Owner logins, one row each, with how many accounts each can see. The
// same two forms as the customers below: a table from desktop width up,
// a stacked list on a phone.

export type GroupListRow = {
  id: string;
  name: string;
  email: string;
  contact_name: string | null;
  created_at: string;
  memberCount: number;
};

function membersLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

export function GroupsTable({ rows }: { rows: GroupListRow[] }) {
  return (
    <Card className="overflow-hidden">
      <table className="hidden w-full text-sm lg:table">
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

      <ul className="divide-y divide-hairline lg:hidden">
        {rows.map(row => (
          <li key={row.id}>
            <Link href={`/customers/${row.id}`} className={LIST_ROW}>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</p>
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{membersLabel(row.memberCount)}</p>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
