// Resend transport.
//
// Deliberately a thin wrapper over fetch rather than the SDK: one POST, no extra
// dependency, and the failure surface stays visible.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendResult {
  ok: boolean;
  /** Resend's message id, for tracing a delivery back to an alert. */
  id?: string;
  error?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL);
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  // Fail closed and say so. Silently succeeding here would mean an alerting
  // system that reports every alert as delivered while sending nothing.
  if (!apiKey || !from) {
    return { ok: false, error: "email_not_configured" };
  }
  if (params.to.length === 0) {
    return { ok: false, error: "no_recipients" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        ...(process.env.ALERT_REPLY_TO ? { reply_to: process.env.ALERT_REPLY_TO } : {}),
      }),
      // A hung provider must not hold the cron run open until the platform
      // kills it, which would leave every claimed alert on an expired lease.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Logged, not returned to any client — this route has no user-facing
      // caller, but the body can echo recipient addresses.
      console.error("[alerts] resend rejected the send", {
        status: response.status,
        body: body.slice(0, 500),
      });
      return { ok: false, error: `resend_${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    console.error("[alerts] resend request failed", error);
    return { ok: false, error: "request_failed" };
  }
}
