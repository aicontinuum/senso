export const APP_NAME = "Senso Admin";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/customers" },
  { label: "Devices",   href: "/devices" },
  { label: "Billing",   href: "/billing" },
  { label: "Settings",  href: "/settings" },
];

// ── Watchdog ────────────────────────────────────────────────────────────────
// The alert sender runs every five minutes. Six missed runs is unambiguous — a
// slow run or a single blip will not trip it, and anything that has been quiet
// for half an hour is genuinely stopped rather than late.
export const ALERTS_HEARTBEAT_MAX_AGE_MS = 30 * 60 * 1000;

/** Key the alert sender stamps in `job_heartbeats`. */
export const ALERTS_JOB_KEY = 'alerts';
