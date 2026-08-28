import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { ReportClient } from "./ReportClient";

export default async function ReportsPage() {
  const customer = await requireCustomer();

  const supabase = await createClient();

  const { data: gateways } = await supabase
    .from("gateways")
    .select("sensors (id, name, decommissioned_at)")
    .eq("customer_id", customer.id)
    .is("decommissioned_at", null);

  const sensors = (gateways ?? []).flatMap(
    (g) => ((g.sensors ?? []) as { id: string; name: string; decommissioned_at: string | null }[])
      .filter((s) => s.decommissioned_at === null) as { id: string; name: string }[],
  );
  const sensorIds = sensors.map((s) => s.id);

  const { data: alertConfigRows } = sensorIds.length > 0
    ? await supabase
        .from("alert_configs")
        .select("sensor_id, type, threshold")
        .in("sensor_id", sensorIds)
    : { data: [] as { sensor_id: string; type: string; threshold: number }[] };

  const configs = sensorIds.map((sid) => {
    const rows = (alertConfigRows ?? []).filter((c) => c.sensor_id === sid);
    const belowMin = rows.find((c) => c.type === "min");
    const aboveMax = rows.find((c) => c.type === "max");
    return {
      sensorId: sid,
      minTemp: belowMin?.threshold ?? 2,
      maxTemp: aboveMax?.threshold ?? 8,
    };
  });

  return (
    <ReportClient
      customerName={customer.name}
      sensors={sensors}
      configs={configs}
      timezone={customer.timezone}
    />
  );
}
