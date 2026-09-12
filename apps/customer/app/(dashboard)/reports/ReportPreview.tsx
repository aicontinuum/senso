import { Badge } from "@senso/ui";
import { formatTemp, formatReadingTime, formatDateTimeLong } from "@/lib/temperature";
import { rangeAt, formatRange, isOutOfRangeAt, hasRange, thresholdSummary } from "@/lib/thresholds";
import { formatDevEui } from "@/lib/deveui";
import { commissionedNote } from "@/lib/commissioning";
import { commentForReading } from "@/lib/alert-comments";
import { retiredNote, type ReportSensor } from "./report-model";

interface ReportPreviewProps {
  sensors: ReportSensor[];
  customerName: string;
  timezone: string;
  periodStart: number;
  now: number;
  periodLabel: string;
  tzNote: string;
}

const TH = "whitespace-nowrap py-2 pr-6 text-left font-medium text-muted-foreground";
const TD = "whitespace-nowrap py-1.5 pr-6";

// The on-screen rendering of the report: one section per sensor, page-broken
// for print. It reads from the same ReportSensor list as the PDF and CSV, so
// the three cannot disagree.
export function ReportPreview({
  sensors,
  customerName,
  timezone,
  periodStart,
  now,
  periodLabel,
  tzNote,
}: ReportPreviewProps) {
  return (
    <div>
      {sensors.map(({ sensor, history, readings, notes }, i) => {
        const commissioned = commissionedNote(sensor.commissionedAt, periodStart, timezone);
        const retired = retiredNote(sensor, timezone);
        const summary = thresholdSummary(history, readings);
        const deviceId = formatDevEui(sensor.hardwareId);
        return (
          <div key={sensor.id} className={`mb-10 ${i > 0 ? "break-before-page" : ""}`}>
            <div className="mb-3">
              <h2 className="text-2xl font-bold">{sensor.name}</h2>
              {deviceId && (
                <p className="font-mono text-xs text-muted-foreground">Device ID: {deviceId}</p>
              )}
              <h3 className="mt-1 text-base font-semibold">Monitoring Report</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{customerName}</p>
              <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>
              <p className="text-sm text-muted-foreground">Generated: {formatDateTimeLong(now, timezone)}</p>
              <p className="text-sm text-muted-foreground">{tzNote}</p>
              {commissioned && <p className="mt-1 text-sm font-medium">{commissioned}</p>}
              {retired && <p className="mt-1 text-sm font-medium">{retired}</p>}
            </div>

            <hr className="mb-4 border-border" />

            {summary && <p className="mb-3 text-sm text-muted-foreground">{summary}</p>}

            {readings.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">No readings in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Date / Time</th>
                      <th className={TH}>Temperature</th>
                      <th className={TH}>Range</th>
                      <th className={TH}>Status</th>
                      <th className="py-2 text-left font-medium text-muted-foreground">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => {
                      const applied = rangeAt(history, r.recordedAt);
                      const known = hasRange(applied);
                      const out = isOutOfRangeAt(r.temperature, applied);
                      const note = commentForReading(notes, r.temperature, applied, r.recordedAt);
                      return (
                        // Fixed-width values never wrap: on a narrow screen the
                        // table scrolls sideways inside its wrapper instead of
                        // breaking a timestamp over three lines. Only the
                        // comment, which is prose, is allowed to wrap.
                        <tr key={r.id} className="border-b border-border/50">
                          <td className={`${TD} text-muted-foreground`}>{formatReadingTime(r.recordedAt, timezone)}</td>
                          <td className={`${TD} font-mono`}>{formatTemp(r.temperature)}</td>
                          <td className={`${TD} font-mono text-muted-foreground`}>{formatRange(applied)}</td>
                          <td className={TD}>
                            {/* Same badge vocabulary as the dashboard, so a
                                breach looks the same everywhere it is shown. */}
                            {!known ? (
                              <Badge variant="offline" dot>No limit set</Badge>
                            ) : out ? (
                              <Badge variant="alert" dot>Out of range</Badge>
                            ) : (
                              <Badge variant="ok" dot>OK</Badge>
                            )}
                          </td>
                          {/* React escapes this; the text is customer-typed. */}
                          <td className="py-1.5 text-muted-foreground">{note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
