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
  /** Sensors in service in the dashboard's current scope. */
  sensorCount: number;
  /** The dashboard's branch, or all. */
  branchId: string;
  /** "sensors" at one site, "sensors across all branches" on All. */
  scopeNote: string;
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

export function QuickReportCard({ sensorCount, branchId, scopeNote }: QuickReportCardProps) {
  const [range, setRange] = useState<RangeValue>(DEFAULT_QUICK_RANGE);
  const hrefOf = (generate: boolean) => reportHref({ range, branchId, generate, branchParam: BRANCH_PARAM, allBranches: ALL_BRANCHES });
  const none = sensorCount === 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Quick report</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {none
              ? "No sensors in service yet"
              : `All ${sensorCount} ${scopeNote} · Last ${QUICK_RANGES.find((r) => r.value === range)?.label}`}
          </p>
        </div>
        <Link href={hrefOf(false)} className="shrink-0 text-sm font-medium text-primary hover:underline">
          Customise
        </Link>
      </div>

      <SegmentedControl aria-label="Period" options={QUICK_RANGES} value={range} onChange={setRange} block />

      {none ? (
        <Button block disabled>
          <Download className="size-4" />
          Generate report
        </Button>
      ) : (
        <Button block asChild>
          <Link href={hrefOf(true)}>
            <GenerateLabel />
          </Link>
        </Button>
      )}
    </Card>
  );
}
