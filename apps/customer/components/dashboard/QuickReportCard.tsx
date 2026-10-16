"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { Download, FileText } from "lucide-react";
import { Button, Card } from "@senso/ui";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BRANCH_PARAM, ALL_BRANCHES } from "@/lib/branches";
import { RANGES, reportHref, type RangeValue } from "@/app/(dashboard)/reports/report-model";

// The report most people want, one press away: every sensor in service on
// the dashboard, over a day or a week. The press opens the reports page
// with the report already running, so the next press is Download or
// Share; Customise opens the same page with its settings open instead.
// The dashboard's branch goes along, so the report covers what the page
// shows.

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

// The label dims and says so between the press and the reports page, so
// a slow connection never reads as an ignored press.
function GenerateLabel() {
  const { pending } = useLinkStatus();
  return (
    <>
      <Download className="size-4" />
      {pending ? "Opening…" : "Generate report"}
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
    <Card className="flex flex-col gap-4 border-transparent bg-brand-gradient p-5 text-white shadow-accent-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-white/15 ring-1 ring-white/25">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Quick report</p>
          <p className="mt-0.5 text-sm text-white/75">{none ? "No sensors in service yet" : "All sensors"}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full border border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Link href={hrefOf(false)}>Customise</Link>
        </Button>
      </div>

      <SegmentedControl aria-label="Period" options={QUICK_RANGES} value={range} onChange={setRange} block tone="inverse" />

      {none ? (
        <Button block variant="secondary" disabled>
          <Download className="size-4" />
          Generate report
        </Button>
      ) : (
        <Button block variant="secondary" asChild>
          <Link href={hrefOf(true)}>
            <GenerateLabel />
          </Link>
        </Button>
      )}
    </Card>
  );
}
