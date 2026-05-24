import { notFound } from 'next/navigation';
import {
  mockCustomers,
  mockGateways,
  mockSensors,
  mockAlertConfigs,
} from '@senso/mock-data';
import { CustomerDetailClient } from './CustomerDetailClient';

export function generateStaticParams() {
  return mockCustomers.map(c => ({ id: c.id }));
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = mockCustomers.find(c => c.id === id);
  if (!customer) notFound();

  const gateways    = mockGateways.filter(g => g.customerId === id);
  const sensors     = mockSensors.filter(s => s.customerId === id);
  const alertConfigs = mockAlertConfigs.filter(ac => sensors.some(s => s.id === ac.sensorId));

  return (
    <CustomerDetailClient
      customer={customer}
      gateways={gateways}
      sensors={sensors}
      alertConfigs={alertConfigs}
    />
  );
}
