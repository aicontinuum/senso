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

// ── Platform watchdog ───────────────────────────────────────────────────────
// How stale each stamp in `platform_status` may be before the admin card turns.
// The VPS pulses every minute, so ten minutes is ten misses — unambiguous, and
// far shorter than the 35 minutes a sensor gets, so the platform is always known
// to be down before any fridge could look silent because of it.
export const VPS_PULSE_STALE_MS = 10 * 60 * 1000;
/** The alert route runs every five minutes; three misses is late, not dead. */
export const JOB_RUN_STALE_MS = 15 * 60 * 1000;
/** Job names written to `job_runs` and read back by the watchdog. */
export const JOB_SWEEP = 'sweep';
export const JOB_SENDER = 'sender';
