"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatTemp,
  formatReadingTime,
  formatDateTimeLong,
} from "@/lib/temperature";
import {
  rangeAt,
  formatRange,
  isOutOfRangeAt,
  hasRange,
  thresholdSummary,
  type ThresholdVersion,
} from "@/lib/thresholds";
import { timezoneLabel } from "@/lib/timezones";

type SensorShape = { id: string; name: string; decommissionedAt: string | null };
type ReadingShape = { id: string; temperature: number; recordedAt: string };

// Shape of the embedded select in generate(): each alert_config carries its own
// effective-dated versions.
type ConfigWithHistory = {
  sensor_id: string;
  type: "min" | "max";
  alert_threshold_history: {
    threshold: number;
    effective_from: string;
    effective_to: string | null;
  }[] | null;
};

interface Props {
  customerName: string;
  sensors: SensorShape[];
  timezone: string;
}

type RangeValue = "12h" | "24h" | "3d" | "7d";

const RANGES: { label: string; value: RangeValue; ms: number }[] = [
  { label: "Last 12 hours", value: "12h", ms: 12 * 3_600_000 },
  { label: "Last 24 hours", value: "24h", ms: 24 * 3_600_000 },
  { label: "Last 3 days",   value: "3d",  ms: 3 * 24 * 3_600_000 },
  { label: "Last week",     value: "7d",  ms: 7 * 24 * 3_600_000 },
];

type ReportSensor = {
  sensor: SensorShape;
  history: ThresholdVersion[];
  readings: ReadingShape[];
};

// A retired sensor's readings simply stop partway through the period. Saying so on
// the report explains the gap to an inspector, rather than leaving it to look like
// the sensor failed or data was lost.
function retiredNote(sensor: SensorShape, timezone: string): string | null {
  if (!sensor.decommissionedAt) return null;
  return `Sensor retired ${formatDateTimeLong(sensor.decommissionedAt, timezone)} — no readings recorded after this time.`;
}

async function buildReportPDF(
  sensors: ReportSensor[],
  rangeMs: number,
  now: number,
  customerName: string,
  timezone: string,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const pageH = 297;
  const bottomMargin = 15;
  // Four columns across 182mm of content width. "Range" carries the limits that
  // applied to that row, so a threshold change mid-period is visible per reading
  // rather than hidden behind a single header value.
  const col1 = margin;
  const col2 = margin + 58;
  const col3 = margin + 95;
  const col4 = margin + 140;

  const periodLabel = `${formatDateTimeLong(now - rangeMs, timezone)} – ${formatDateTimeLong(now, timezone)}`;

  const drawTableHeader = (y: number): number => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Date / Time", col1, y);
    doc.text("Temperature", col2, y);
    doc.text("Range", col3, y);
    doc.text("Status", col4, y);
    doc.setTextColor(0, 0, 0);
    const lineY = y + 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, lineY, margin + contentWidth, lineY);
    return lineY + 3;
  };

  let isFirst = true;
  for (const { sensor, history, readings } of sensors) {
    if (!isFirst) doc.addPage();
    isFirst = false;
    let y = margin;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(sensor.name, margin, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Monitoring Report", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(customerName, margin, y);
    y += 5;
    doc.text(`Period: ${periodLabel}`, margin, y);
    y += 5;
    doc.text(`Generated: ${formatDateTimeLong(now, timezone)}`, margin, y);
    y += 5;
    doc.text(`All times shown in ${timezoneLabel(timezone)}`, margin, y);
    y += 5;
    const pdfRetired = retiredNote(sensor, timezone);
    if (pdfRetired) {
      doc.setFont("helvetica", "bold");
      doc.text(pdfRetired, margin, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    }
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    const pdfSummary = thresholdSummary(history, readings);
    if (pdfSummary) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(pdfSummary, margin, y);
      y += 7;
    }

    if (readings.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("No readings in this period", margin, y);
      continue;
    }

    y = drawTableHeader(y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    for (const r of readings) {
      if (y > pageH - bottomMargin) {
        doc.addPage();
        y = drawTableHeader(margin);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
      }
      const applied = rangeAt(history, r.recordedAt);
      const known = hasRange(applied);
      const out = isOutOfRangeAt(r.temperature, applied);
      doc.setTextColor(80, 80, 80);
      doc.text(formatReadingTime(r.recordedAt, timezone), col1, y);
      doc.setTextColor(0, 0, 0);
      doc.text(formatTemp(r.temperature), col2, y);
      doc.setTextColor(80, 80, 80);
      doc.text(formatRange(applied), col3, y);
      if (!known) doc.setTextColor(120, 120, 120);
      else doc.setTextColor(out ? 220 : 22, out ? 38 : 163, out ? 38 : 74);
      doc.text(known ? (out ? "Out of range" : "OK") : "No limit set", col4, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }
  }

  return doc;
}

export function ReportClient({ customerName, sensors, timezone }: Props) {
  // Retired sensors stay listed so their history remains reportable, but they are
  // not part of the default selection or "Select all" — a routine report should
  // look exactly as it did before any sensor was retired.
  const activeSensors = sensors.filter((s) => s.decommissionedAt === null);

  const [range, setRange] = useState<RangeValue>("24h");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(activeSensors.map((s) => s.id)),
  );
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [readingsBySensor, setReadingsBySensor] = useState<Map<string, ReadingShape[]>>(new Map());
  const [historyBySensor, setHistoryBySensor] = useState<Map<string, ThresholdVersion[]>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const allSelected =
    activeSensors.length > 0 && activeSensors.every((s) => selectedIds.has(s.id));
  const rangeMs = RANGES.find((r) => r.value === range)!.ms;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(activeSensors.map((s) => s.id)));
    setGenerated(false);
  }

  function toggleSensor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setGenerated(false);
  }

  async function generate() {
    setGenerating(true);
    const supabase = createClient();
    const now = Date.now();
    const since = new Date(now - rangeMs).toISOString();
    const ids = Array.from(selectedIds);

    // The full threshold history is loaded, not just the versions overlapping the
    // period: a version that opened long before the period is the one in force at
    // its start, so filtering by the period would drop exactly the row needed.
    const [readingsRes, configsRes] = await Promise.all([
      supabase
        .from("readings")
        .select("id, sensor_id, temperature, recorded_at")
        .in("sensor_id", ids)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("alert_configs")
        .select("sensor_id, type, alert_threshold_history (threshold, effective_from, effective_to)")
        .in("sensor_id", ids),
    ]);

    // A report is a compliance record, so a failed query must not quietly become
    // a plausible-looking document. Without this, an unreadable threshold history
    // renders as "No limit set" on every row — indistinguishable from a sensor
    // that genuinely had no limits.
    if (readingsRes.error || configsRes.error) {
      console.error("Report data load failed", readingsRes.error, configsRes.error);
      setLoadError("Could not load the report data. Nothing has been generated — please try again.");
      setGenerated(false);
      setGenerating(false);
      return;
    }

    const { data } = readingsRes;
    const configRows = configsRes.data;

    // Every alert_config gets an opening version from the trigger, so a config
    // with no versions means the threshold history is not in place. Reporting
    // "No limit set" against a limit that plainly exists would misstate the
    // record, so refuse rather than guess.
    const missingHistory = ((configRows ?? []) as ConfigWithHistory[])
      .filter((c) => (c.alert_threshold_history ?? []).length === 0);
    if (missingHistory.length > 0) {
      console.error("alert_configs without threshold history", missingHistory);
      setLoadError(
        "Threshold history is unavailable, so readings cannot be checked against the limits that applied when they were recorded. The report has not been generated.",
      );
      setGenerated(false);
      setGenerating(false);
      return;
    }

    const byId = new Map<string, ReadingShape[]>();
    for (const r of data ?? []) {
      const arr = byId.get(r.sensor_id) ?? [];
      arr.push({ id: r.id, temperature: r.temperature, recordedAt: r.recorded_at });
      byId.set(r.sensor_id, arr);
    }

    const historyById = new Map<string, ThresholdVersion[]>();
    for (const config of (configRows ?? []) as ConfigWithHistory[]) {
      const versions = (config.alert_threshold_history ?? []).map((v) => ({
        type: config.type,
        threshold: v.threshold,
        effectiveFrom: v.effective_from,
        effectiveTo: v.effective_to,
      }));
      historyById.set(config.sensor_id, [
        ...(historyById.get(config.sensor_id) ?? []),
        ...versions,
      ]);
    }

    setLoadError(null);
    setReadingsBySensor(byId);
    setHistoryBySensor(historyById);
    setGenerated(true);
    setGenerating(false);
  }

  const now = Date.now();
  const periodLabel = `${formatDateTimeLong(now - rangeMs, timezone)} – ${formatDateTimeLong(now, timezone)}`;
  const tzNote = `All times shown in ${timezoneLabel(timezone)}`;

  const reportSensors: ReportSensor[] = sensors
    .filter((s) => selectedIds.has(s.id))
    .map((s) => ({
      sensor: s,
      history: historyBySensor.get(s.id) ?? [],
      readings: readingsBySensor.get(s.id) ?? [],
    }));

  async function handlePrint() {
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    doc.output("dataurlnewwindow");
  }

  async function handleShare() {
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    const fileName = `monitoring-report-${new Date(now).toISOString().split("T")[0]}.pdf`;
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (typeof navigator === "undefined") return;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Monitoring Report — ${customerName}` }); } catch { /* cancelled */ }
    } else if (typeof navigator.share === "function") {
      try { await navigator.share({ title: `Monitoring Report — ${customerName}`, text: `Temperature monitoring report for ${customerName}.\n\nPeriod: ${periodLabel}\nGenerated: ${formatDateTimeLong(now, timezone)}\n${tzNote}` }); } catch { /* cancelled */ }
    } else {
      setShareOpen((v) => !v);
    }
  }

  function downloadCSV() {
    setDownloadOpen(false);
    const lines: string[] = [
      `"Monitoring Report - ${customerName}"`,
      `"Period: ${periodLabel}"`,
      `"Generated: ${formatDateTimeLong(now, timezone)}"`,
      `"${tzNote}"`,
      "",
    ];
    for (const { sensor, history, readings } of reportSensors) {
      lines.push(`"${sensor.name}"`);
      const csvRetired = retiredNote(sensor, timezone);
      if (csvRetired) lines.push(`"${csvRetired}"`);
      const csvSummary = thresholdSummary(history, readings);
      if (csvSummary) lines.push(`"${csvSummary}"`);
      lines.push('"Date / Time","Temperature","Range","Status"');
      for (const r of readings) {
        const applied = rangeAt(history, r.recordedAt);
        const status = hasRange(applied)
          ? (isOutOfRangeAt(r.temperature, applied) ? "Out of range" : "OK")
          : "No limit set";
        lines.push(`"${formatReadingTime(r.recordedAt, timezone)}","${formatTemp(r.temperature)}","${formatRange(applied)}","${status}"`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-report-${new Date(now).toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    setDownloadOpen(false);
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    doc.save(`monitoring-report-${new Date(now).toISOString().split("T")[0]}.pdf`);
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="print:hidden mb-6 space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Time range</p>
            <div className="flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setRange(r.value); setGenerated(false); }}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    range === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-fit">
            <p className="text-sm font-medium mb-2">Sensors</p>
            {sensors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sensors available.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" />
                  <span className="font-medium">{allSelected ? "Deselect all" : "Select all"}</span>
                </label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                    {sensors.map((s) => (
                      <label key={s.id} className="flex min-w-0 items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSensor(s.id)} className="accent-primary shrink-0" />
                        <span className="truncate">{s.name}</span>
                        {s.decommissionedAt && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                            Retired
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={generate}
            disabled={selectedIds.size === 0 || generating}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed w-fit"
          >
            {generating ? "Generating…" : "Generate report"}
          </button>
        </div>
      </div>

      {/* Report output */}
      {loadError && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {generated && (
        <div>
          {/* Screen-only action bar */}
          <div className="print:hidden flex items-center justify-between mb-4 pb-2 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {reportSensors.length} sensor{reportSensors.length !== 1 ? "s" : ""} · {RANGES.find((r) => r.value === range)!.label}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted">Print</button>
              <div className="relative">
                <button onClick={handleShare} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted">Export</button>
                {shareOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-md text-sm z-20 min-w-[160px]">
                      <button onClick={() => { window.print(); setShareOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-muted rounded-t-md">Save as PDF</button>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`Monitoring Report — ${customerName}`)}&body=${encodeURIComponent(`Temperature monitoring report for ${customerName}.\n\nPeriod: ${periodLabel}\nGenerated: ${formatDateTimeLong(now, timezone)}\n${tzNote}`)}`}
                        onClick={() => setShareOpen(false)}
                        className="block px-4 py-2 hover:bg-muted rounded-b-md"
                      >
                        Send by email
                      </a>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setDownloadOpen((v) => !v)} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted">Download</button>
                {downloadOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDownloadOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-md text-sm z-20 min-w-[148px]">
                      <button onClick={downloadCSV} className="w-full text-left px-4 py-2 hover:bg-muted rounded-t-md">Download CSV</button>
                      <button onClick={downloadPDF} className="w-full text-left px-4 py-2 hover:bg-muted rounded-b-md">Download PDF</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {reportSensors.map(({ sensor, history, readings }, i) => (
            <div key={sensor.id} className={`mb-10 ${i > 0 ? "break-before-page" : ""}`}>
              <div className="mb-3">
                <h2 className="text-2xl font-bold">{sensor.name}</h2>
                <h3 className="text-base font-semibold mt-1">Monitoring Report</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{customerName}</p>
                <p className="text-sm text-muted-foreground">Period: {periodLabel}</p>
                <p className="text-sm text-muted-foreground">Generated: {formatDateTimeLong(now, timezone)}</p>
                <p className="text-sm text-muted-foreground">{tzNote}</p>
                {retiredNote(sensor, timezone) && (
                  <p className="text-sm font-medium mt-1">{retiredNote(sensor, timezone)}</p>
                )}
              </div>

              <hr className="mb-4 border-border" />

              {thresholdSummary(history, readings) && (
                <p className="text-sm text-muted-foreground mb-3">
                  {thresholdSummary(history, readings)}
                </p>
              )}

              {readings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No readings in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Date / Time</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Temperature</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Range</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((r) => {
                        const applied = rangeAt(history, r.recordedAt);
                        const known = hasRange(applied);
                        const out = isOutOfRangeAt(r.temperature, applied);
                        return (
                          <tr key={r.id} className="border-b border-border/50">
                            <td className="py-1.5 pr-6 text-muted-foreground">{formatReadingTime(r.recordedAt, timezone)}</td>
                            <td className="py-1.5 pr-6 font-mono">{formatTemp(r.temperature)}</td>
                            <td className="py-1.5 pr-6 font-mono text-muted-foreground">{formatRange(applied)}</td>
                            <td
                              className={`py-1.5 font-medium ${
                                !known ? "text-muted-foreground" : out ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              {known ? (out ? "✗ Out of range" : "✓ OK") : "No limit set"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
