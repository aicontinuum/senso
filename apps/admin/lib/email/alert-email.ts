// The alert email itself.
//
// Read on a phone, mid-service, by a manager who needs one thing: what is wrong
// and which fridge. Everything here serves that; detail lives behind the link.

export type AlertKind = "threshold" | "sensor_offline" | "gateway_offline";

export interface AlertLine {
  kind: AlertKind;
  /** Sensor name, or the gateway's name for a site-wide outage. */
  subject: string;
  /** DevEUI, formatted. Absent for gateway alerts. */
  deviceId?: string | null;
  /** The reading that breached, already formatted with its unit. */
  reading?: string | null;
  /** The limits in force when it breached, already formatted. */
  range?: string | null;
  /** When the alert opened, as an ISO instant. */
  triggeredAt: string;
  /** How many times this alert has already been sent — 0 means it is new. */
  notifyCount: number;
}

export interface AlertEmailInput {
  customerName: string;
  /**
   * IANA zone for this customer, e.g. "Asia/Qatar".
   *
   * Required with no default, deliberately. This runs on a server in UTC, and a
   * formatter that quietly falls back to a house default would look correct for
   * Qatar customers and be silently hours wrong for anyone else. Omitting it
   * should be a type error, not a wrong timestamp in an alert.
   */
  timezone: string;
  alerts: AlertLine[];
  /** Absolute base URL of the customer app, for the deep link. */
  appUrl: string;
}

function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

function headline(alert: AlertLine): string {
  switch (alert.kind) {
    case "threshold":
      return `${alert.subject} is out of range`;
    case "sensor_offline":
      return `${alert.subject} has stopped reporting`;
    case "gateway_offline":
      return `${alert.subject} is offline — all sensors on this gateway`;
  }
}

export function alertEmailSubject(alerts: AlertLine[], customerName: string): string {
  if (alerts.length === 0) return `Senso alert — ${customerName}`;

  const gateway = alerts.find((a) => a.kind === "gateway_offline");
  if (gateway) return `Senso: ${gateway.subject} is offline — ${customerName}`;

  if (alerts.length === 1) {
    const [only] = alerts;
    // A reminder says "still", so a second email does not read as a second
    // problem. The word goes inside the sentence, not in front of the brand.
    const still = only.notifyCount > 0 ? "still " : "";
    return only.kind === "threshold"
      ? `Senso: ${only.subject} ${still}out of range${only.reading ? ` (${only.reading})` : ""}`
      : `Senso: ${only.subject} ${still}not reporting`;
  }

  return `Senso: ${alerts.length} alerts — ${customerName}`;
}

/** Plain text, because it is what reaches a watch or a locked screen intact. */
export function alertEmailText(input: AlertEmailInput): string {
  const { customerName, timezone, alerts, appUrl } = input;
  const lines: string[] = [`${customerName}`, ""];

  for (const alert of alerts) {
    lines.push(headline(alert));
    if (alert.reading) {
      lines.push(`  Reading: ${alert.reading}${alert.range ? `   Range: ${alert.range}` : ""}`);
    }
    if (alert.deviceId) lines.push(`  Device:  ${alert.deviceId}`);
    lines.push(`  Since:   ${formatInstant(alert.triggeredAt, timezone)}`);
    lines.push("");
  }

  lines.push(`View: ${appUrl}/dashboard`);
  lines.push("");
  lines.push(`All times shown in ${timezone}.`);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function alertEmailHtml(input: AlertEmailInput): string {
  const { customerName, timezone, alerts, appUrl } = input;

  // Inline styles and a table are not a stylistic choice — mail clients strip
  // <style> blocks and have no grid or flexbox worth relying on.
  const rows = alerts
    .map((alert) => {
      const accent = alert.kind === "threshold" ? "#e5484d" : "#a0a0b4";
      const detail = [
        alert.reading ? `<strong style="font-size:20px;color:${accent}">${escapeHtml(alert.reading)}</strong>` : "",
        alert.range ? `<span style="color:#55556a">Range ${escapeHtml(alert.range)}</span>` : "",
      ]
        .filter(Boolean)
        .join("&nbsp;&nbsp;");

      return `
      <tr><td style="padding:16px 0;border-bottom:1px solid #eeeef3">
        <div style="font-size:15px;font-weight:600;color:#17161c">${escapeHtml(headline(alert))}</div>
        ${detail ? `<div style="margin-top:6px;font-size:14px">${detail}</div>` : ""}
        ${alert.deviceId ? `<div style="margin-top:6px;font-family:monospace;font-size:12px;color:#757589">${escapeHtml(alert.deviceId)}</div>` : ""}
        <div style="margin-top:6px;font-size:13px;color:#55556a">Since ${escapeHtml(formatInstant(alert.triggeredAt, timezone))}</div>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafc;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17161c">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eeeef3;border-radius:20px;padding:24px">
    <tr><td>
      <div style="font-size:13px;color:#55556a">${escapeHtml(customerName)}</div>
      <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
      <a href="${escapeHtml(appUrl)}/dashboard"
         style="display:inline-block;margin-top:20px;background:#6e5be4;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">
        Open Senso
      </a>
      <div style="margin-top:20px;font-size:12px;color:#757589">All times shown in ${escapeHtml(timezone)}.</div>
    </td></tr>
  </table>
</body></html>`;
}
