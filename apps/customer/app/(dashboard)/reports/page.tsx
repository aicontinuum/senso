import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/supabase/get-customer";
import { ReportClient } from "./ReportClient";

export default async function ReportsPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/login");

  const supabase = await createClient();

  const { data: gateways } = await supabase
    .from("gateways")
    .select("sensors (id, name)")
    .eq("customer_id", customer.id);

  const sensors = (gateways ?? []).flatMap(
    (g) => (g.sensors ?? []) as { id: string; name: string }[],
  );
  const sensorIds = sensors.map((s) => s.id);

  const { data: alertConfigs } = sensorIds.length > 0
    ? await supabase
        .from("alert_configs")
        .select("sensor_id, min_temp, max_temp")
        .in("sensor_id", sensorIds)
    : { data: [] as { sensor_id: string; min_temp: number; max_temp: number }[] };

  const configs = (alertConfigs ?? []).map((c) => ({
    sensorId: c.sensor_id,
    minTemp: c.min_temp,
    maxTemp: c.max_temp,
  }));

  return (
    <ReportClient
      customerName={customer.name}
      sensors={sensors}
      configs={configs}
    />
  );
}
