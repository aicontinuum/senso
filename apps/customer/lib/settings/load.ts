// Everything the settings page shows, for one login. The clock is taken
// once here and returned, so every relative figure on the page agrees and
// the page component stays pure.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isGatewayOnline, isSensorOnline } from "@senso/status";
import { groupByBranch, hasBranches, loadBranches, type BranchOption } from "@/lib/branches";
import type { CustomerRecord } from "@/lib/supabase/get-customer";
import type { Customer, Gateway, Sensor } from "@senso/types";

export type SettingsData = {
  now: number;
  customerShape: Customer;
  branches: BranchOption[];
  initialAlertEmails: string[];
  sensorGroups: { name: string | null; sensors: Sensor[] }[];
  gatewayGroups: { name: string | null; gateways: Gateway[] }[];
};

export async function loadSettings(supabase: SupabaseClient, customer: CustomerRecord, now: number = Date.now()): Promise<SettingsData> {
  const { data: customerData } = await supabase
    .from("customers")
    .select("alert_recipients")
    .eq("id", customer.id)
    .single();
  const initialAlertEmails = (customerData?.alert_recipients as string[]) ?? [];

  const [branches, { data: gateways }] = await Promise.all([
    loadBranches(supabase, customer.id),
    supabase
      .from("gateways")
      .select("id, name, branch_id, is_online, firmware_version, last_seen_at, sensors (id, name, status, decommissioned_at)")
      .eq("customer_id", customer.id)
      .is("decommissioned_at", null),
  ]);
  const branchOfGateway = new Map((gateways ?? []).map((g) => [g.id, g.branch_id as string]));

  const allSensors = (gateways ?? []).flatMap(
    (g) => (g.sensors ?? [])
      .filter((s: { decommissioned_at: string | null }) => s.decommissioned_at === null)
      .map((s: { id: string; name: string; status: string }) => ({
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
    status: isSensorOnline(s.status, lastReadingAtBySensor.get(s.id), now) ? "online" : "offline",
  }));

  const gatewayShapes: Gateway[] = (gateways ?? []).map((g) => ({
    id: g.id,
    customerId: customer.id,
    name: g.name ?? "Gateway",
    status: isGatewayOnline(g.is_online, g.last_seen_at, now) ? "online" : "offline",
    lastSeen: g.last_seen_at ?? new Date().toISOString(),
    firmwareVersion: g.firmware_version ?? "—",
  }));

  // Under a heading per branch once there is more than one; otherwise one
  // unnamed group, and the cards look as they always did.
  const sensorGroups = hasBranches(branches)
    ? groupByBranch(branches, sensorShapes, (s) => branchOfGateway.get(s.gatewayId) ?? "").map((g) => ({ name: g.branch.name, sensors: g.items }))
    : [{ name: null, sensors: sensorShapes }];
  const gatewayGroups = hasBranches(branches)
    ? groupByBranch(branches, gatewayShapes, (g) => branchOfGateway.get(g.id) ?? "").map((g) => ({ name: g.branch.name, gateways: g.items }))
    : [{ name: null, gateways: gatewayShapes }];

  return { now, customerShape, branches, initialAlertEmails, sensorGroups, gatewayGroups };
}
