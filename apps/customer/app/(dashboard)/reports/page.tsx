import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { ReportClient } from "./ReportClient";
import { hasBranches, loadBranches } from "@/lib/branches";

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
  const [branches, { data: gateways }] = await Promise.all([
    loadBranches(supabase, customer.id),
    supabase
      .from("gateways")
      .select("branch_id, sensors (id, name, hardware_id, decommissioned_at, commissioned_at)")
      .eq("customer_id", customer.id),
  ]);

  const multiBranch = hasBranches(branches);
  const branchNameOf = (id: string) => (multiBranch ? branches.find((b) => b.id === id)?.name ?? null : null);
  // Gateways come back in no particular order; listing sensors branch by
  // branch keeps an all-branches picker readable in one pass.
  const branchRank = new Map(branches.map((b, i) => [b.id, i]));
  const sensors = (gateways ?? []).sort((a, b) => (branchRank.get(a.branch_id as string) ?? 0) - (branchRank.get(b.branch_id as string) ?? 0)).flatMap(
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
        branchId: g.branch_id as string,
        branchName: branchNameOf(g.branch_id as string),
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
      branches={branches}
      sensors={sensors}
      timezone={customer.timezone}
    />
  );
}
