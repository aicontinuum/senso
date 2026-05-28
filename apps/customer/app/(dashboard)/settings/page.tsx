import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";
import { AccountInfoSection } from "./AccountInfoSection";
import { SensorsSection } from "./SensorsSection";
import { GatewaysSection } from "./GatewaysSection";
import { AlertRecipientsSection } from "./AlertRecipientsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import type { Customer, Gateway, Sensor } from "@senso/types";

export default async function SettingsPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/login");

  const supabase = await createClient();

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
    status: s.status as "online" | "offline",
  }));

  const gatewayShapes: Gateway[] = (gateways ?? []).map((g) => ({
    id: g.id,
    customerId: customer.id,
    name: g.name ?? "Gateway",
    status: g.is_online ? "online" : "offline",
    lastSeen: g.last_seen_at ?? new Date().toISOString(),
    firmwareVersion: g.firmware_version ?? "—",
  }));

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountInfoSection customer={customerShape} />
      <SensorsSection sensors={sensorShapes} />
      <GatewaysSection gateways={gatewayShapes} />
      <AlertRecipientsSection />
      <ChangePasswordSection />
    </div>
  );
}
