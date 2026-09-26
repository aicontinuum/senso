import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge, Button } from '@senso/ui';
import { AccountInfoSection, type CustomerRow } from '@/components/customers/AccountInfoSection';
import { AccountStatusSection } from '@/components/customers/AccountStatusSection';
import { AlertRecipientsSection } from '@/components/customers/AlertRecipientsSection';
import { BranchesSection } from '@/components/customers/BranchesSection';
import { GatewaysSection, type GatewayRow } from '@/components/customers/GatewaysSection';
import { GroupMembersSection } from '@/components/customers/GroupMembersSection';
import { SensorsSection, type SensorRow } from '@/components/customers/SensorsSection';
import type { AccountRef, GroupMember, GroupRef } from '@/lib/groups/load';
import type { Branch } from '@/types/branches';

interface Props {
  customer: CustomerRow;
  branches: Branch[];
  gateways: GatewayRow[];
  sensors: SensorRow[];
  members: GroupMember[];
  candidates: AccountRef[];
  groupOf: GroupRef | null;
  /** Server clock at render, so relative times match the rest of the page. */
  now: number;
}

// One customer, top to bottom: who they are, their branches, the gateways
// at them, the sensors on those, and who gets emailed. Each card owns its
// own editing state. A group is who they are and who they can see: it owns
// no devices and is emailed about nothing, so those cards do not exist.
export function CustomerDetailClient({ customer, branches, gateways, sensors, members, candidates, groupOf, now }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/customers">
            <ChevronLeft className="size-4" />
            Customers
          </Link>
        </Button>
        {/* What kind of account this is, as a chip beside the name: Group
            for an owner login, or the group a member belongs to, which is
            also the way to it. The same chip the customers list shows. */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          {customer.is_group && <Badge variant="offline">Group</Badge>}
          {groupOf && (
            <Link href={`/customers/${groupOf.id}`} title={`Open ${groupOf.name}, whose owner login can see this account`} className="rounded-chip">
              <Badge variant="outline" className="text-muted-foreground transition-colors hover:bg-sunken hover:text-foreground">In {groupOf.name}</Badge>
            </Link>
          )}
        </div>
      </div>

      <AccountInfoSection customer={customer} />
      <AccountStatusSection customerId={customer.id} name={customer.name} status={customer.status} suspendedAt={customer.suspended_at} />
      {customer.is_group ? (
        <GroupMembersSection groupId={customer.id} members={members} candidates={candidates} />
      ) : (
        <>
          <BranchesSection customerId={customer.id} branches={branches} gateways={gateways} />
          <GatewaysSection customerId={customer.id} branches={branches} gateways={gateways} sensors={sensors} now={now} />
          <SensorsSection customerId={customer.id} gateways={gateways} sensors={sensors} />
          <AlertRecipientsSection customer={customer} />
        </>
      )}
    </div>
  );
}
