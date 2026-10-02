import { useSyncExternalStore } from "react";
import { ArrowLeft, Download, Mail, Printer, Share2 } from "lucide-react";
import { Button } from "@senso/ui";
import { rangeOption, type PdfAction, type RangeValue, type ReportFormat } from "./report-model";

// The capability never changes during a page's life, so there is nothing to
// subscribe to.
function subscribeNever() {
  return () => {};
}

function readCanShare() {
  return typeof navigator.share === "function";
}

interface ReportActionBarProps {
  range: RangeValue;
  format: ReportFormat;
  sensorCount: number;
  /** Which PDF action is building its file, if any: that button says so and the others wait. */
  busy: PdfAction | null;
  /** Return to the settings card, keeping the report in memory. */
  onBack: () => void;
  onPrint: () => void;
  onDownload: () => void;
  /** Web Share, where the browser has it. */
  onShare: () => void;
  /** The mailto fallback where it does not: the body is prepared by the caller. */
  mailtoHref: string;
}

const PREPARING = "Preparing…";

// Once a report exists it is the focus. The settings collapse to this one line:
// the way back and what was generated on the left, what to do with it on the
// right. The chosen format's download is the primary action; Print and Share
// are secondary. Back is a real button, not a link in the caption — it is the
// first thing most people want after reading a report.
export function ReportActionBar({
  range,
  format,
  sensorCount,
  busy,
  onBack,
  onPrint,
  onDownload,
  onShare,
  mailtoHref,
}: ReportActionBarProps) {
  // Web Share is a browser capability, so it is only known on the client. The
  // server snapshot says no, which renders the mailto fallback first and keeps
  // server and client markup the same until hydration.
  const canShare = useSyncExternalStore(subscribeNever, readCanShare, () => false);
  const working = busy !== null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to settings
        </Button>
        <span className="text-sm text-muted-foreground">
          {rangeOption(range).label} · {sensorCount} sensor{sensorCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrint} disabled={working}>
          <Printer className="size-4" />
          {busy === "print" ? PREPARING : "Print"}
        </Button>
        {canShare ? (
          <Button variant="secondary" size="sm" onClick={onShare} disabled={working}>
            <Share2 className="size-4" />
            {busy === "share" ? PREPARING : "Share"}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" asChild>
            <a href={mailtoHref}>
              <Mail className="size-4" />
              Email
            </a>
          </Button>
        )}
        <Button size="sm" onClick={onDownload} disabled={working}>
          <Download className="size-4" />
          {busy === "download" ? PREPARING : `Download ${format.toUpperCase()}`}
        </Button>
      </div>
    </div>
  );
}
