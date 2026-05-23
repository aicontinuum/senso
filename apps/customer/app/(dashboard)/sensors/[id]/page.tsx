import { notFound } from "next/navigation";
import { mockSensors, mockAlertConfigs, mockGateway } from "@senso/mock-data";
import { SensorDetailClient } from "./SensorDetailClient";

export function generateStaticParams() {
  return mockSensors.filter(s => s.customerId === 'customer_001').map((s) => ({ id: s.id }));
}

export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sensor = mockSensors.find((s) => s.id === id);
  if (!sensor) notFound();

  const config = mockAlertConfigs.find((c) => c.sensorId === id);
  if (!config) notFound();

  return (
    <SensorDetailClient sensor={sensor} config={config} gateway={mockGateway} />
  );
}
