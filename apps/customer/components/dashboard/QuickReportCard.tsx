"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { Download, FileText, SlidersHorizontal } from "lucide-react";
import { Button, Card } from "@senso/ui";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { QUICK_ACTION_TILE } from "@/components/dashboard/DashboardSkeleton";
import { BRANCH_PARAM, ALL_BRANCHES } from "@/lib/branches";
import { RANGES, reportHref, type RangeValue } from "@/app/(dashboard)/reports/report-model";

// The report most people want, one press away: every sensor in service on
// the dashboard, over a day or a week. The press opens the reports page
// with the report already running, so the next press is Download or
// Share; the sliders open the same page with its settings instead. The
// dashboard's branch goes along, so the report covers what the page
// shows. A small widget, well under a sensor tile's width, so everything
// in it is short: the periods as "24 hours" and "7 days", the action as Generate.

interface QuickReportCardProps {
  /** Sensors in service in the dashboard's current scope; none means no report. */
  sensorCount: number;
  /** The dashboard's branch, or all. */
  branchId: string;
}

const QUICK_RANGES = RANGES.filter((r) => r.value === "24h" || r.value === "7d").map((r) => ({
  value: r.value,
  label: r.value === "24h" ? "24 hours" : "7 days",
}));
const DEFAULT_QUICK_RANGE: RangeValue = "7d";

// The label says so between the press and the reports page, so a slow
// connection never reads as an ignored press.
function GenerateLabel() {
  const { pending } = useLinkStatus();
  return (
    <>
      <Download className="size-4" />
      {pending ? "Opening…" : "Generate"}
    </>
  );
}

export function QuickReportCard({ sensorCount, branchId }: QuickReportCardProps) {
  const [range, setRange] = useState<RangeValue>(DEFAULT_QUICK_RANGE);
  const hrefOf = (generate: boolean) => reportHref({ range, branchId, generate, branchParam: BRANCH_PARAM, allBranches: ALL_BRANCHES });
  const none = sensorCount === 0;

  return (
    // The one tile on the page that is an action rather than a reading, so
    // it carries the brand: the gradient surface, white type, and the
    // controls drawn as tints of white, with the filled button white so it
    // is still the only filled button in the card.
    <Card className={`${QUICK_ACTION_TILE} border-transparent bg-brand-gradient text-white shadow-accent-sm`}>
      {/* The title with the icon before it, then the controls, a clear
          gap between them. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-px size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Quick report</p>
            <p className="mt-0.5 text-xs text-white/75">{none ? "No sensors in service" : "All sensors"}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Customise report" title="Customise" className="-m-1 size-8 shrink-0 text-white/80 hover:bg-white/15 hover:text-white lg:size-8">
          <Link href={hrefOf(false)}>
            <SlidersHorizontal className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <SegmentedControl aria-label="Period" options={QUICK_RANGES} value={range} onChange={setRange} block columns={2} tone="inverse" />
        {none ? (
          <Button block size="sm" variant="secondary" disabled>
            <Download className="size-4" />
            Generate
          </Button>
        ) : (
          <Button block size="sm" variant="secondary" asChild>
            <Link href={hrefOf(true)}>
              <GenerateLabel />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
