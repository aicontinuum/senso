import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";
import { SensorDetailClient } from "./SensorDetailClient";
import { AutoRefresh } from "@/components/auto-refresh";
import type { Sensor, AlertConfig, Gateway, Reading } from "@senso/types";

export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer();
  if (!customer) redirect("/login");

  const supabase = await createClient();

  const { data: sensorRow } = await supabase
    .from("sensors")
    .select("id, name, status, battery_level, gateway_id, gateways!inner (id, name, is_online, firmware_version, last_seen_at, customer_id)")
    .eq("id", id)
    .single();

  if (!sensorRow) notFound();

  const gw = sensorRow.gateways as unknown as {
    id: string; name: string | null; is_online: boolean;
    firmware_version: string | null; last_seen_at: string | null; customer_id: string;
  };

  if (gw.customer_id !== customer.id) notFound();

  const [{ data: configRows }, { data: readingRows }, { data: customerData }] = await Promise.all([
    supabase.from("alert_configs").select("id, sensor_id, type, threshold, email_recipients").eq("sensor_id", id),
    supabase.from("readings").select("id, temperature, recorded_at").eq("sensor_id", id).order("recorded_at", { ascending: false }).limit(5),
    supabase.from("customers").select("alert_recipients").eq("id", customer.id).single(),
  ]);

  const belowMin = (configRows ?? []).find((c) => c.type === "min");
  const aboveMax = (configRows ?? []).find((c) => c.type === "max");

  const sensor: Sensor = {
    id: sensorRow.id,
    gatewayId: sensorRow.gateway_id,
    customerId: customer.id,
    name: sensorRow.name,
    status: sensorRow.status as "online" | "offline",
    batteryLevel: sensorRow.battery_level ?? undefined,
    lastReading: readingRows?.[0]
      ? { id: readingRows[0].id, sensorId: id, temperature: readingRows[0].temperature, recordedAt: readingRows[0].recorded_at }
      : undefined,
  };

  const config: AlertConfig = {
    id: configRows?.[0]?.id ?? `${id}-config`,
    sensorId: id,
    minTemp: belowMin?.threshold ?? 2,
    maxTemp: aboveMax?.threshold ?? 8,
    emailRecipients: Array.isArray(configRows?.[0]?.email_recipients)
      ? (configRows![0].email_recipients as string[])
      : [],
  };

  const gateway: Gateway = {
    id: gw.id,
    customerId: customer.id,
    name: gw.name ?? "Gateway",
    status: gw.is_online ? "online" : "offline",
    lastSeen: gw.last_seen_at ?? new Date().toISOString(),
    firmwareVersion: gw.firmware_version ?? "—",
  };

  const accountRecipients = (customerData?.alert_recipients as string[]) ?? [];

  const recentReadings: Reading[] = (readingRows ?? [])
    .map((r) => ({ id: r.id, sensorId: id, temperature: r.temperature, recordedAt: r.recorded_at }))
    .reverse();

  return (
    <>
      <AutoRefresh />
      <SensorDetailClient sensor={sensor} config={config} gateway={gateway} accountRecipients={accountRecipients} recentReadings={recentReadings} timezone={customer.timezone} />
    </>
  );
}
