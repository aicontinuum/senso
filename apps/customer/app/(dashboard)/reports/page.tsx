import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { ReportClient } from "./ReportClient";
import { loadScope, siteOfGateway } from "@/lib/scope";

export default async function ReportsPage() {
  const customer = await requireCustomer();

  const supabase = await createClient();

  // Reports are the one screen that deliberately includes retired sensors. Every
  // live view hides them, but a report is inherently historical: an auditor asking
  // for a fridge's records from before it was decommissioned must still be able to
  // produce them. They're listed with a "Retired" marker and unselected by default.
  //
  // Sensors that were never commissioned are the opposite case: they have no
  // history to report, only bench readings, so they are listed but cannot be
  // selected at all.
  const scope = await loadScope(supabase, customer);
  const { data: gateways } = await supabase
    .from("gateways")
    .select("customer_id, branch_id, sensors (id, name, hardware_id, decommissioned_at, commissioned_at)")
    .in("customer_id", scope.customerIds);

  const sensors = (gateways ?? []).flatMap(
    (g) => ((g.sensors ?? []) as {
      id: string;
      name: string;
      hardware_id: string | null;
      decommissioned_at: string | null;
      commissioned_at: string | null;
    }[])
      .map((s) => ({
        id: s.id,
        name: s.name,
        branchId: siteOfGateway(scope, g),
        hardwareId: s.hardware_id,
        decommissionedAt: s.decommissioned_at,
        commissionedAt: s.commissioned_at,
      })),
  );
  // Thresholds are deliberately not fetched here. A report judges each reading
  // against the limits in force when it was recorded, so the client loads the
  // effective-dated history alongside the readings once a period is chosen —
  // fetching today's values here is what made reports rewrite their own history.
  return (
    <ReportClient
      customerName={customer.name}
      branches={scope.sites}
      isGroup={scope.isGroup}
      sensors={sensors}
      timezone={customer.timezone}
    />
  );
}
