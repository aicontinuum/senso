import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerDetail } from '@/lib/customers/detail';
import { CustomerDetailClient } from './CustomerDetailClient';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadCustomerDetail(createAdminClient(), id);
  if (!detail) notFound();
  const { now, customer, branches, gateways, sensors, members, candidates, groupOf } = detail;

  return (
    <CustomerDetailClient
      customer={customer}
      branches={branches}
      gateways={gateways}
      sensors={sensors}
      members={members}
      candidates={candidates}
      groupOf={groupOf}
      now={now}
    />
  );
}
