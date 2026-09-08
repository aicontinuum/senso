import { formatTemp, formatReadingTime, formatDateTimeLong } from "@/lib/temperature";
import {
  rangeAt,
  formatRange,
  isOutOfRangeAt,
  hasRange,
  thresholdSummary,
} from "@/lib/thresholds";
import { timezoneLabel } from "@/lib/timezones";
import { formatDevEui } from "@/lib/deveui";
import { commissionedNote } from "@/lib/commissioning";
import { commentForReading } from "@/lib/alert-comments";
import { COMMENT_PDF_MAX_LINES } from "@/lib/constants";
import { STATUS_TEXT_RGB, NEUTRAL_RGB } from "@/lib/status-colors";
import { retiredNote, type ReportSensor } from "./report-model";

export async function buildReportPDF(
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
  const col2 = margin + 40;
  const col3 = margin + 68;
  const col4 = margin + 100;
  const col5 = margin + 133;
  // Whatever is left after the four fixed columns. Comments are free text, so
  // this is the one column that has to wrap rather than be sized to its content.
  const commentWidth = contentWidth - (col5 - margin);

  const periodLabel = `${formatDateTimeLong(now - rangeMs, timezone)} – ${formatDateTimeLong(now, timezone)}`;

  const drawTableHeader = (y: number): number => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NEUTRAL_RGB.muted);
    doc.text("Date / Time", col1, y);
    doc.text("Temperature", col2, y);
    doc.text("Range", col3, y);
    doc.text("Status", col4, y);
    doc.text("Comment", col5, y);
    doc.setTextColor(...NEUTRAL_RGB.primary);
    const lineY = y + 3;
    doc.setDrawColor(...NEUTRAL_RGB.rule);
    doc.line(margin, lineY, margin + contentWidth, lineY);
    return lineY + 3;
  };

  let isFirst = true;
  for (const { sensor, history, readings, notes } of sensors) {
    if (!isFirst) doc.addPage();
    isFirst = false;
    let y = margin;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(sensor.name, margin, y);
    y += 7;
    // The device's permanent identity, so the record stays traceable if the
    // sensor is renamed later.
    const pdfDeviceId = formatDevEui(sensor.hardwareId);
    if (pdfDeviceId) {
      doc.setFontSize(9);
      doc.setFont("courier", "normal");
      doc.setTextColor(...NEUTRAL_RGB.muted);
      doc.text(`Device ID: ${pdfDeviceId}`, margin, y);
      doc.setTextColor(...NEUTRAL_RGB.primary);
      doc.setFont("helvetica", "normal");
      y += 5;
    }
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
    const pdfCommissioned = commissionedNote(sensor.commissionedAt, now - rangeMs, timezone);
    if (pdfCommissioned) {
      doc.setFont("helvetica", "bold");
      // Long enough to wrap on A4, and a note that runs off the page edge says
      // nothing at all.
      for (const line of doc.splitTextToSize(pdfCommissioned, contentWidth)) {
        doc.text(line, margin, y);
        y += 5;
      }
      doc.setFont("helvetica", "normal");
    }
    const pdfRetired = retiredNote(sensor, timezone);
    if (pdfRetired) {
      doc.setFont("helvetica", "bold");
      doc.text(pdfRetired, margin, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    }
    y += 2;
    doc.setDrawColor(...NEUTRAL_RGB.rule);
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
      doc.setTextColor(...NEUTRAL_RGB.secondary);
      doc.text(formatReadingTime(r.recordedAt, timezone), col1, y);
      doc.setTextColor(...NEUTRAL_RGB.primary);
      doc.text(formatTemp(r.temperature), col2, y);
      doc.setTextColor(...NEUTRAL_RGB.secondary);
      doc.text(formatRange(applied), col3, y);
      // Same status tones the screen uses, so the exported record and the page
      // an inspector is shown cannot disagree about what counts as a breach.
      doc.setTextColor(
        ...(!known ? STATUS_TEXT_RGB.offline : out ? STATUS_TEXT_RGB.alert : STATUS_TEXT_RGB.ok),
      );
      doc.text(known ? (out ? "Out of range" : "OK") : "No limit set", col4, y);
      doc.setTextColor(...NEUTRAL_RGB.secondary);
      // A note repeats on every reading of its incident, so it is capped at two
      // lines: the full text is on the alert page, and a long note wrapping over
      // five lines on a hundred consecutive rows would bury the readings it is
      // there to explain.
      const note = commentForReading(notes, r.temperature, applied, r.recordedAt);
      let rowHeight = 4.5;
      if (note) {
        const lines = doc.splitTextToSize(note, commentWidth).slice(0, COMMENT_PDF_MAX_LINES);
        lines.forEach((line: string, i: number) => doc.text(line, col5, y + i * 3.6));
        rowHeight = Math.max(rowHeight, lines.length * 3.6 + 1);
      }
      doc.setTextColor(...NEUTRAL_RGB.primary);
      y += rowHeight;
    }
  }

  return doc;
}
