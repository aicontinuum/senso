import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerDetail } from '@/lib/customers/detail';
import { loadAvailableSensors } from '@/lib/network/available';
import { CustomerDetailClient } from './CustomerDetailClient';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const detail = await loadCustomerDetail(admin, id);
  if (!detail) notFound();
  const { now, customer, branches, gateways, sensors, members, candidates, groupOf } = detail;
  // A group owns no devices, so the network server is not asked for it.
  const availableSensors = customer.is_group ? { state: 'unavailable' as const } : await loadAvailableSensors(admin);

  return (
    <CustomerDetailClient
      customer={customer}
      branches={branches}
      gateways={gateways}
      sensors={sensors}
      members={members}
      candidates={candidates}
      groupOf={groupOf}
      availableSensors={availableSensors}
      now={now}
    />
  );
}
