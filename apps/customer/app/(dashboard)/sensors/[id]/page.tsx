import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";
import { SensorDetailClient } from "./SensorDetailClient";
import type { Sensor, AlertConfig, Gateway } from "@senso/types";

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
    .select("id, name, is_online, battery_level, gateway_id, gateways!inner (id, name, is_online, firmware_version, last_seen, customer_id)")
    .eq("id", id)
    .single();

  if (!sensorRow) notFound();

  const gw = sensorRow.gateways as unknown as {
    id: string; name: string | null; is_online: boolean;
    firmware_version: string | null; last_seen: string | null; customer_id: string;
  };

  if (gw.customer_id !== customer.id) notFound();

  const [{ data: configRow }, { data: lastReadingRow }] = await Promise.all([
    supabase.from("alert_configs").select("id, sensor_id, min_temp, max_temp, email_recipients").eq("sensor_id", id).single(),
    supabase.from("readings").select("id, temperature, recorded_at").eq("sensor_id", id).order("recorded_at", { ascending: false }).limit(1).single(),
  ]);

  const sensor: Sensor = {
    id: sensorRow.id,
    gatewayId: sensorRow.gateway_id,
    customerId: customer.id,
    name: sensorRow.name,
    status: sensorRow.is_online ? "online" : "offline",
    batteryLevel: sensorRow.battery_level ?? undefined,
    lastReading: lastReadingRow
      ? { id: lastReadingRow.id, sensorId: id, temperature: lastReadingRow.temperature, recordedAt: lastReadingRow.recorded_at }
      : undefined,
  };

  const config: AlertConfig = {
    id: configRow?.id ?? `${id}-config`,
    sensorId: id,
    minTemp: configRow?.min_temp ?? 2,
    maxTemp: configRow?.max_temp ?? 8,
    emailRecipients: Array.isArray(configRow?.email_recipients) ? (configRow.email_recipients as string[]) : [],
  };

  const gateway: Gateway = {
    id: gw.id,
    customerId: customer.id,
    name: gw.name ?? "Gateway",
    status: gw.is_online ? "online" : "offline",
    lastSeen: gw.last_seen ?? new Date().toISOString(),
    firmwareVersion: gw.firmware_version ?? "—",
  };

  return <SensorDetailClient sensor={sensor} config={config} gateway={gateway} />;
}
