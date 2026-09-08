"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTemp, formatReadingTime, formatDateTimeLong } from "@/lib/temperature";
import {
  rangeAt,
  formatRange,
  isOutOfRangeAt,
  hasRange,
  thresholdSummary,
  type ThresholdVersion,
} from "@/lib/thresholds";
import { timezoneLabel } from "@/lib/timezones";
import { formatDevEui } from "@/lib/deveui";
import { commissionedNote, inServiceReadings } from "@/lib/commissioning";
import type { AlertNote } from "@/lib/alert-comments";
import { REPORT_ALERT_LOOKBACK } from "@/lib/constants";
import { buildReportPDF } from "./build-report-pdf";
import { ReportSettingsCard } from "./ReportSettingsCard";
import { ReportActionBar } from "./ReportActionBar";
import { ReportPreview } from "./ReportPreview";
import {
  DEFAULT_FORMAT,
  DEFAULT_RANGE,
  REPORT_VIEW,
  VIEW_PARAM,
  rangeOption,
  reportFileName,
  retiredNote,
  type RangeValue,
  type ReadingShape,
  type ReportFormat,
  type ReportSensor,
  type SensorShape,
} from "./report-model";

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

export function ReportClient({ customerName, sensors, timezone }: Props) {
  // A sensor that was never commissioned has no reportable history at all — only
  // readings taken before it was installed — so it cannot be selected. Retired
  // sensors are the opposite: still selectable, because their history is real,
  // but kept out of the default selection and "Select all" so a routine report
  // looks exactly as it did before any sensor was retired.
  const reportableSensors = sensors.filter((s) => s.commissionedAt !== null);
  const activeSensors = reportableSensors.filter((s) => s.decommissionedAt === null);

  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE);
  const [format, setFormat] = useState<ReportFormat>(DEFAULT_FORMAT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(activeSensors.map((s) => s.id)),
  );
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  // The view is read from the URL (see VIEW_PARAM). A generated report is shown
  // only while the URL says so; leaving by any route — the back button here,
  // the sidebar link, the browser's back — lands on the settings with the
  // report still in memory, so a tweak and regenerate stays quick.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reportView = searchParams.get(VIEW_PARAM) === REPORT_VIEW;
  const showReport = generated && reportView;

  function openReportView() {
    router.push(`${pathname}?${VIEW_PARAM}=${REPORT_VIEW}`);
  }

  function backToSettings() {
    router.push(pathname);
  }
  const [readingsBySensor, setReadingsBySensor] = useState<Map<string, ReadingShape[]>>(new Map());
  const [historyBySensor, setHistoryBySensor] = useState<Map<string, ThresholdVersion[]>>(new Map());
  const [notesBySensor, setNotesBySensor] = useState<Map<string, AlertNote[]>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const allSelected =
    activeSensors.length > 0 && activeSensors.every((s) => selectedIds.has(s.id));
  const rangeMs = rangeOption(range).ms;

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

  function changeRange(next: RangeValue) {
    setRange(next);
    setGenerated(false);
  }

  async function generate() {
    setGenerating(true);
    const supabase = createClient();
    const now = Date.now();
    const since = new Date(now - rangeMs).toISOString();
    // Never query for a sensor that has nothing reportable, whatever state the
    // selection got into.
    const ids = reportableSensors.filter((x) => selectedIds.has(x.id)).map((x) => x.id);

    // The full threshold history is loaded, not just the versions overlapping the
    // period: a version that opened long before the period is the one in force at
    // its start, so filtering by the period would drop exactly the row needed.
    const [readingsRes, configsRes, notesRes] = await Promise.all([
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
      // Alerts carry the supervisor's note. `!inner` on alert_configs both scopes
      // this to the selected sensors and drops the offline kinds, which have no
      // config and nothing to say about a reading.
      supabase
        .from("alert_logs")
        .select("triggered_at, alert_configs!inner (sensor_id, type), alert_comments (body)")
        .in("alert_configs.sensor_id", ids)
        .order("triggered_at", { ascending: false })
        .limit(REPORT_ALERT_LOOKBACK),
    ]);

    // A report is a compliance record, so a failed query must not quietly become
    // a plausible-looking document. Without this, an unreadable threshold history
    // renders as "No limit set" on every row — indistinguishable from a sensor
    // that genuinely had no limits.
    // Deliberately not part of the refusal below. A reading, its limits and its
    // verdict must be right or the report must not exist; a missing note only
    // costs context, and refusing to produce a compliance record because an
    // explanatory comment would not load gets the priority backwards.
    if (notesRes.error) {
      console.error("Alert comments load failed", notesRes.error);
    }

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

    type AlertRow = {
      triggered_at: string;
      alert_configs: { sensor_id: string; type: "min" | "max" } | null;
      alert_comments: { body: string }[] | { body: string } | null;
    };
    const notesById = new Map<string, AlertNote[]>();
    for (const row of (notesRes.data ?? []) as unknown as AlertRow[]) {
      const config = row.alert_configs;
      if (!config) continue;
      // PostgREST returns an embedded one-to-one as an object or a single-element
      // array depending on how it infers the relationship; accept both rather
      // than depending on which.
      const embedded = Array.isArray(row.alert_comments)
        ? row.alert_comments[0]
        : row.alert_comments;
      const list = notesById.get(config.sensor_id) ?? [];
      list.push({
        type: config.type,
        triggeredAt: row.triggered_at,
        comment: embedded?.body ?? null,
      });
      notesById.set(config.sensor_id, list);
    }

    setLoadError(null);
    setNotesBySensor(notesById);
    setReadingsBySensor(byId);
    setHistoryBySensor(historyById);
    setGenerated(true);
    setGenerating(false);
    openReportView();
  }

  const now = Date.now();
  const periodStart = now - rangeMs;
  const periodLabel = `${formatDateTimeLong(periodStart, timezone)} – ${formatDateTimeLong(now, timezone)}`;
  const tzNote = `All times shown in ${timezoneLabel(timezone)}`;

  // Readings from before the sensor entered service are dropped here rather than
  // in the query: one `.in()` fetch cannot carry a different lower bound per
  // sensor, and every output builds from this list, so trimming once is what
  // keeps screen, PDF and CSV agreeing.
  const reportSensors: ReportSensor[] = reportableSensors
    .filter((s) => selectedIds.has(s.id))
    .map((s) => ({
      sensor: s,
      history: historyBySensor.get(s.id) ?? [],
      readings: inServiceReadings(s.commissionedAt, readingsBySensor.get(s.id) ?? []),
      notes: notesBySensor.get(s.id) ?? [],
    }));

  const shareTitle = `Monitoring Report — ${customerName}`;
  const shareText = `Temperature monitoring report for ${customerName}.\n\nPeriod: ${periodLabel}\nGenerated: ${formatDateTimeLong(now, timezone)}\n${tzNote}`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText)}`;

  async function handlePrint() {
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    doc.output("dataurlnewwindow");
  }

  async function handleShare() {
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    const blob = doc.output("blob");
    const file = new File([blob], reportFileName("pdf", now), { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: shareTitle }); } catch { /* cancelled */ }
    } else {
      try { await navigator.share({ title: shareTitle, text: shareText }); } catch { /* cancelled */ }
    }
  }

  function downloadCSV() {
    const lines: string[] = [
      `"Monitoring Report - ${customerName}"`,
      `"Period: ${periodLabel}"`,
      `"Generated: ${formatDateTimeLong(now, timezone)}"`,
      `"${tzNote}"`,
      "",
    ];
    // Comments are deliberately not exported here. The CSV is a data extract for
    // filtering and pivoting, and repeating a sentence of free text across every
    // row of an episode makes it worse at that job — while also being the one
    // place customer-typed text could carry a spreadsheet formula. The PDF is
    // the compliance document, and it carries them.
    for (const { sensor, history, readings } of reportSensors) {
      lines.push(`"${sensor.name}"`);
      const csvDeviceId = formatDevEui(sensor.hardwareId);
      if (csvDeviceId) lines.push(`"Device ID: ${csvDeviceId}"`);
      const csvCommissioned = commissionedNote(sensor.commissionedAt, periodStart, timezone);
      if (csvCommissioned) lines.push(`"${csvCommissioned}"`);
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
    a.download = reportFileName("csv", now);
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    const doc = await buildReportPDF(reportSensors, rangeMs, now, customerName, timezone);
    doc.save(reportFileName("pdf", now));
  }

  return (
    <div>
      <div className="print:hidden mb-6 space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>

        {!showReport ? (
          <ReportSettingsCard
            range={range}
            onRangeChange={changeRange}
            format={format}
            onFormatChange={setFormat}
            sensors={sensors}
            selectedIds={selectedIds}
            allSelected={allSelected}
            onToggleAll={toggleAll}
            onToggleSensor={toggleSensor}
            onGenerate={generate}
            generating={generating}
          />
        ) : (
          <ReportActionBar
            range={range}
            format={format}
            sensorCount={reportSensors.length}
            onBack={backToSettings}
            onPrint={handlePrint}
            onDownload={format === "pdf" ? downloadPDF : downloadCSV}
            onShare={handleShare}
            mailtoHref={mailtoHref}
          />
        )}
      </div>

      {loadError && (
        <p role="alert" className="mb-4 rounded-md border border-alert-border bg-alert-soft px-4 py-3 text-sm text-alert-text">
          {loadError}
        </p>
      )}

      {showReport && (
        <ReportPreview
          sensors={reportSensors}
          customerName={customerName}
          timezone={timezone}
          periodStart={periodStart}
          now={now}
          periodLabel={periodLabel}
          tzNote={tzNote}
        />
      )}
    </div>
  );
}
