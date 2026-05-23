"use client";
import { useState } from "react";
import {
  mockCustomer,
  mockSensors,
  mockAlertConfigs,
  mockReadings,
} from "@senso/mock-data";
import {
  isOutOfRange,
  formatTemp,
  formatThreshold,
  formatReadingTime,
} from "@/lib/temperature";

const MOCK_NOW = new Date("2025-05-22T03:00:00.000Z").getTime();
const CUSTOMER_ID = 'customer_001';
const customerSensors = mockSensors.filter(s => s.customerId === CUSTOMER_ID);

type RangeValue = "12h" | "24h" | "3d" | "7d";

const RANGES: { label: string; value: RangeValue; ms: number }[] = [
  { label: "Last 12 hours", value: "12h", ms: 12 * 3_600_000 },
  { label: "Last 24 hours", value: "24h", ms: 24 * 3_600_000 },
  { label: "Last 3 days",   value: "3d",  ms: 3  * 24 * 3_600_000 },
  { label: "Last week",     value: "7d",  ms: 7  * 24 * 3_600_000 },
];

function fmtDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function periodLabel(rangeMs: number): string {
  return `${fmtDateTime(MOCK_NOW - rangeMs)} – ${fmtDateTime(MOCK_NOW)}`;
}

type ReportSensor = {
  sensor: { name: string };
  config: { minTemp: number; maxTemp: number } | undefined;
  readings: { id: string; temperature: number; recordedAt: string }[];
};

async function buildReportPDF(sensors: ReportSensor[], rangeMs: number) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const pageH = 297;
  const bottomMargin = 15;
  const col1 = margin;
  const col2 = margin + 65;
  const col3 = margin + 105;

  const drawTableHeader = (y: number): number => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Date / Time", col1, y);
    doc.text("Temperature", col2, y);
    doc.text("Status", col3, y);
    doc.setTextColor(0, 0, 0);
    const lineY = y + 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, lineY, margin + contentWidth, lineY);
    return lineY + 3;
  };

  let isFirst = true;
  for (const { sensor, config, readings } of sensors) {
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
    doc.text(mockCustomer.name, margin, y);
    y += 5;
    doc.text(`Period: ${periodLabel(rangeMs)}`, margin, y);
    y += 5;
    doc.text(`Generated: ${fmtDateTime(MOCK_NOW)}`, margin, y);
    y += 7;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    if (config) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Threshold: ${formatThreshold(config.minTemp, config.maxTemp)}`, margin, y);
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
      const out = config ? isOutOfRange(r.temperature, config.minTemp, config.maxTemp) : false;
      doc.setTextColor(80, 80, 80);
      doc.text(formatReadingTime(r.recordedAt), col1, y);
      doc.setTextColor(0, 0, 0);
      doc.text(formatTemp(r.temperature), col2, y);
      if (out) {
        doc.setTextColor(220, 38, 38);
      } else {
        doc.setTextColor(22, 163, 74);
      }
      doc.text(out ? "Out of range" : "OK", col3, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }
  }

  return doc;
}

export default function ReportsPage() {
  const [range, setRange] = useState<RangeValue>("24h");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(customerSensors.map((s) => s.id))
  );
  const [generated, setGenerated] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const allSelected = selectedIds.size === customerSensors.length;

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(customerSensors.map((s) => s.id))
    );
    setGenerated(false);
  }

  function toggleSensor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGenerated(false);
  }

  const rangeMs = RANGES.find((r) => r.value === range)!.ms;

  async function handlePrint() {
    const doc = await buildReportPDF(reportSensors, rangeMs);
    doc.output("dataurlnewwindow");
  }

  async function handleShare() {
    const doc = await buildReportPDF(reportSensors, rangeMs);
    const fileName = `monitoring-report-${new Date(MOCK_NOW).toISOString().split("T")[0]}.pdf`;
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });

    if (typeof navigator === "undefined") return;

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Monitoring Report — ${mockCustomer.name}` });
      } catch { /* user cancelled */ }
    } else if (typeof navigator.share === "function") {
      // Basic share without file support — send text summary
      try {
        await navigator.share({
          title: `Monitoring Report — ${mockCustomer.name}`,
          text: `Temperature monitoring report for ${mockCustomer.name}.\n\nPeriod: ${periodLabel(rangeMs)}\nGenerated: ${fmtDateTime(MOCK_NOW)}`,
        });
      } catch { /* user cancelled */ }
    } else {
      setShareOpen((v) => !v);
    }
  }

  function downloadCSV() {
    setDownloadOpen(false);
    const lines: string[] = [
      `"Monitoring Report - ${mockCustomer.name}"`,
      `"Period: ${periodLabel(rangeMs)}"`,
      `"Generated: ${fmtDateTime(MOCK_NOW)}"`,
      "",
    ];
    for (const { sensor, config, readings } of reportSensors) {
      lines.push(`"${sensor.name}"`);
      if (config) lines.push(`"Threshold: ${formatThreshold(config.minTemp, config.maxTemp)}"`);
      lines.push('"Date / Time","Temperature","Status"');
      for (const r of readings) {
        const out = config ? isOutOfRange(r.temperature, config.minTemp, config.maxTemp) : false;
        lines.push(`"${formatReadingTime(r.recordedAt)}","${formatTemp(r.temperature)}","${out ? "Out of range" : "OK"}"`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-report-${new Date(MOCK_NOW).toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    setDownloadOpen(false);
    const doc = await buildReportPDF(reportSensors, rangeMs);
    doc.save(`monitoring-report-${new Date(MOCK_NOW).toISOString().split("T")[0]}.pdf`);
  }

  const cutoff = MOCK_NOW - rangeMs;

  const reportSensors = customerSensors
    .filter((s) => selectedIds.has(s.id))
    .map((s) => ({
      sensor: s,
      config: mockAlertConfigs.find((c) => c.sensorId === s.id),
      readings: (mockReadings[s.id] ?? [])
        .filter((r) => new Date(r.recordedAt).getTime() >= cutoff)
        .sort(
          (a, b) =>
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        ),
    }));

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
                  onClick={() => {
                    setRange(r.value);
                    setGenerated(false);
                  }}
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
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-primary"
              />
              <span className="font-medium">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                {customerSensors.map((s) => (
                  <label
                    key={s.id}
                    className="flex min-w-0 items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSensor(s.id)}
                      className="accent-primary shrink-0"
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setGenerated(true)}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate report
        </button>
      </div>

      {/* Report output */}
      {generated && (
        <div>
          {/* Screen-only action bar */}
          <div className="print:hidden flex items-center justify-between mb-4 pb-2 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {reportSensors.length} sensor{reportSensors.length !== 1 ? "s" : ""}{" "}
              · {RANGES.find((r) => r.value === range)!.label}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
              >
                Print
              </button>
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
                >
                  Export
                </button>
                {shareOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShareOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-md text-sm z-20 min-w-[160px]">
                      <button
                        onClick={() => { window.print(); setShareOpen(false); }}
                        className="w-full text-left px-4 py-2 hover:bg-muted rounded-t-md"
                      >
                        Save as PDF
                      </button>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`Monitoring Report — ${mockCustomer.name}`)}&body=${encodeURIComponent(`Temperature monitoring report for ${mockCustomer.name}.\n\nPeriod: ${periodLabel(rangeMs)}\nGenerated: ${fmtDateTime(MOCK_NOW)}`)}`}
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
                <button
                  onClick={() => setDownloadOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
                >
                  Download
                </button>
                {downloadOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDownloadOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-md text-sm z-20 min-w-[148px]">
                      <button
                        onClick={downloadCSV}
                        className="w-full text-left px-4 py-2 hover:bg-muted rounded-t-md"
                      >
                        Download CSV
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="w-full text-left px-4 py-2 hover:bg-muted rounded-b-md"
                      >
                        Download PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {reportSensors.map(({ sensor, config, readings }, i) => (
            <div
              key={sensor.id}
              className={`mb-10 ${i > 0 ? "break-before-page" : ""}`}
            >
              {/* Per-page header — repeats on every printed page */}
              <div className="mb-3">
                <h2 className="text-2xl font-bold">{sensor.name}</h2>
                <h3 className="text-base font-semibold mt-1">Monitoring Report</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {mockCustomer.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Period: {periodLabel(rangeMs)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Generated: {fmtDateTime(MOCK_NOW)}
                </p>
              </div>

              <hr className="mb-4 border-border" />

              {config && (
                <p className="text-sm text-muted-foreground mb-3">
                  Threshold: {formatThreshold(config.minTemp, config.maxTemp)}
                </p>
              )}

              {readings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No readings in this period
                </p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-6 font-medium text-muted-foreground">
                        Date / Time
                      </th>
                      <th className="text-left py-2 pr-6 font-medium text-muted-foreground">
                        Temperature
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => {
                      const out = config
                        ? isOutOfRange(r.temperature, config.minTemp, config.maxTemp)
                        : false;
                      return (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-1.5 pr-6 text-muted-foreground">
                            {formatReadingTime(r.recordedAt)}
                          </td>
                          <td className="py-1.5 pr-6 font-mono">
                            {formatTemp(r.temperature)}
                          </td>
                          <td
                            className={`py-1.5 font-medium ${
                              out ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {out ? "✗ Out of range" : "✓ OK"}
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
