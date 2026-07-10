import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { AccountInfoSection } from "./AccountInfoSection";
import { SensorsSection } from "./SensorsSection";
import { GatewaysSection } from "./GatewaysSection";
import { AlertRecipientsSection } from "./AlertRecipientsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { TimezoneSection } from "./TimezoneSection";
import { isGatewayOnline, isSensorOnline } from "@senso/status";
import type { Customer, Gateway, Sensor } from "@senso/types";

export default async function SettingsPage() {
  const customer = await requireCustomer();

  const supabase = await createClient();

  const { data: customerData } = await supabase
    .from("customers")
    .select("alert_recipients")
    .eq("id", customer.id)
    .single();
  const initialAlertEmails = (customerData?.alert_recipients as string[]) ?? [];

  const { data: gateways } = await supabase
    .from("gateways")
    .select("id, name, is_online, firmware_version, last_seen_at, sensors (id, name, status)")
    .eq("customer_id", customer.id);

  const allSensors = (gateways ?? []).flatMap(
    (g) => (g.sensors ?? []).map((s: { id: string; name: string; status: string }) => ({
      ...s,
      gatewayId: g.id,
    })),
  );
  const sensorIds = allSensors.map((s) => s.id);

  // Latest reading per sensor, for freshness-based online/offline
  const { data: lastReadings } = sensorIds.length > 0
    ? await supabase.from("readings").select("sensor_id, recorded_at").in("sensor_id", sensorIds).order("recorded_at", { ascending: false })
    : { data: [] as { sensor_id: string; recorded_at: string }[] };
  const lastReadingAtBySensor = new Map<string, string>();
  for (const r of lastReadings ?? []) {
    if (!lastReadingAtBySensor.has(r.sensor_id)) lastReadingAtBySensor.set(r.sensor_id, r.recorded_at);
  }

  const customerShape: Customer = {
    id: customer.id,
    name: customer.name,
    contactName: customer.contact_name ?? "",
    contactEmail: customer.email,
    phone: customer.phone ?? undefined,
    billingStatus: "active",
    createdAt: customer.created_at,
  };

  const sensorShapes: Sensor[] = allSensors.map((s) => ({
    id: s.id,
    gatewayId: s.gatewayId,
    customerId: customer.id,
    name: s.name,
    status: isSensorOnline(s.status, lastReadingAtBySensor.get(s.id)) ? "online" : "offline",
  }));

  const gatewayShapes: Gateway[] = (gateways ?? []).map((g) => ({
    id: g.id,
    customerId: customer.id,
    name: g.name ?? "Gateway",
    status: isGatewayOnline(g.is_online, g.last_seen_at) ? "online" : "offline",
    lastSeen: g.last_seen_at ?? new Date().toISOString(),
    firmwareVersion: g.firmware_version ?? "—",
  }));

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountInfoSection customer={customerShape} />
      <TimezoneSection initialTimezone={customer.timezone} />
      <SensorsSection sensors={sensorShapes} />
      <GatewaysSection gateways={gatewayShapes} timezone={customer.timezone} />
      <AlertRecipientsSection initialEmails={initialAlertEmails} />
      <ChangePasswordSection />
    </div>
  );
}
