import { useSyncExternalStore } from "react";
import { Download, Mail, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rangeOption, type RangeValue, type ReportFormat } from "./report-model";

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
  /** Reopen the settings card to change the selection. */
  onChange: () => void;
  onPrint: () => void;
  onDownload: () => void;
  /** Web Share, where the browser has it. */
  onShare: () => void;
  /** The mailto fallback where it does not: the body is prepared by the caller. */
  mailtoHref: string;
}

// Once a report exists it is the focus. The settings collapse to this one line:
// what was generated and how to change it on the left, what to do with it on
// the right. The chosen format's download is the primary action; Print and
// Share are secondary.
export function ReportActionBar({
  range,
  format,
  sensorCount,
  onChange,
  onPrint,
  onDownload,
  onShare,
  mailtoHref,
}: ReportActionBarProps) {
  // Web Share is a browser capability, so it is only known on the client. The
  // server snapshot says no, which renders the mailto fallback first and keeps
  // server and client markup the same until hydration.
  const canShare = useSyncExternalStore(subscribeNever, readCanShare, () => false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {rangeOption(range).label} · {sensorCount} sensor{sensorCount !== 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={onChange}>Change</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrint}>
          <Printer className="size-4" />
          Print
        </Button>
        {canShare ? (
          <Button variant="secondary" size="sm" onClick={onShare}>
            <Share2 className="size-4" />
            Share
          </Button>
        ) : (
          <Button variant="secondary" size="sm" asChild>
            <a href={mailtoHref}>
              <Mail className="size-4" />
              Email
            </a>
          </Button>
        )}
        <Button size="sm" onClick={onDownload}>
          <Download className="size-4" />
          Download {format.toUpperCase()}
        </Button>
      </div>
    </div>
  );
}
