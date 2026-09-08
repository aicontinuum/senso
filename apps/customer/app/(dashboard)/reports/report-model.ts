import { formatDateTimeLong } from "@/lib/temperature";
import type { ThresholdVersion } from "@/lib/thresholds";
import type { AlertNote } from "@/lib/alert-comments";

// Shapes and option lists shared by the report's settings card, preview, PDF and
// CSV. Kept in one place so every output builds from the same definitions.

export type SensorShape = {
  id: string;
  name: string;
  hardwareId: string | null;
  decommissionedAt: string | null;
  /** Null means never installed — bench readings only, nothing reportable. */
  commissionedAt: string | null;
};

export type ReadingShape = { id: string; temperature: number; recordedAt: string };

export type ReportSensor = {
  sensor: SensorShape;
  history: ThresholdVersion[];
  readings: ReadingShape[];
  /** Supervisor notes on this sensor's alerts, for the Comment column. */
  notes: AlertNote[];
};

export type RangeValue = "12h" | "24h" | "3d" | "7d";

export const RANGES: { label: string; value: RangeValue; ms: number }[] = [
  { label: "Last 12 hours", value: "12h", ms: 12 * 3_600_000 },
  { label: "Last 24 hours", value: "24h", ms: 24 * 3_600_000 },
  { label: "Last 3 days",   value: "3d",  ms: 3 * 24 * 3_600_000 },
  { label: "Last week",     value: "7d",  ms: 7 * 24 * 3_600_000 },
];

export const DEFAULT_RANGE: RangeValue = "24h";

export function rangeOption(value: RangeValue) {
  return RANGES.find((r) => r.value === value)!;
}

// The PDF is the compliance document and carries the supervisor comments; the
// CSV is a data extract for filtering and pivoting, and deliberately does not.
export type ReportFormat = "pdf" | "csv";

export const FORMATS: { label: string; value: ReportFormat }[] = [
  { label: "PDF", value: "pdf" },
  { label: "CSV", value: "csv" },
];

export const DEFAULT_FORMAT: ReportFormat = "pdf";

// Which of the page's two views is showing lives in the URL, not in state, so
// that the sidebar's Reports link and the browser's back button both return to
// the settings — the two things people try first when they want out of a
// generated report. The report data itself stays in memory; only the view moves.
export const VIEW_PARAM = "view";
export const REPORT_VIEW = "report";

// A retired sensor's readings simply stop partway through the period. Saying so on
// the report explains the gap to an inspector, rather than leaving it to look like
// the sensor failed or data was lost.
export function retiredNote(sensor: SensorShape, timezone: string): string | null {
  if (!sensor.decommissionedAt) return null;
  return `Sensor retired ${formatDateTimeLong(sensor.decommissionedAt, timezone)} — no readings recorded after this time.`;
}

export function reportFileName(format: ReportFormat, now: number): string {
  return `monitoring-report-${new Date(now).toISOString().split("T")[0]}.${format}`;
}
