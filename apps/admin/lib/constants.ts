export const APP_NAME = "Senso Admin";

/** Where a signed-in admin lands. */
export const DASHBOARD_PATH = "/dashboard";

/** The shortest password an admin may set for a customer login. Checked
 *  in the forms for a quick answer and on the server as the rule. */
export const PASSWORD_MIN_LENGTH = 8;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/customers" },
  { label: "Devices",   href: "/devices" },
  { label: "Billing",   href: "/billing" },
  { label: "Settings",  href: "/settings" },
];

// ── Network server ──────────────────────────────────────────────────────────
// Every sensor is the same model on the same profile, and reports every
// 15 minutes; both are set on the network server at registration, not
// chosen per device. See network-server/README.md §9.
export const NETWORK_DEVICE_PROFILE = 'Dragino LHT65N';
export const SENSOR_REPORTING_INTERVAL_MIN = 15;

// ── Backfill from the sensor's memory ───────────────────────────────────────
// When a live reading arrives after a gap, ingest asks the sensor for the
// readings it stored meanwhile (lib/ingest/backfill.ts).
/** A gap worth filling: the previous reading is older than one interval
 *  plus slack, so at least one reading was missed. */
export const BACKFILL_GAP_MS = (SENSOR_REPORTING_INTERVAL_MIN + 5) * 60 * 1000;
/** How far back a stored reading may be and still be accepted. Decided
 *  2026-10-02: two days covers a weekend outage. */
export const BACKFILL_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/** A stored reading this close to one already on record is the same
 *  measurement, seen twice; the sensor's clock is not ours (S-011E ran six
 *  minutes fast on 2026-10-02, drifting about 45 seconds a day between its
 *  ten-day syncs), so the match is by proximity, not equality. Ten minutes
 *  covers the drift a sync cycle can reach and stays well inside the
 *  15-minute spacing of readings. */
export const BACKFILL_MATCH_WINDOW_MS = 10 * 60 * 1000;
/** The poll window is widened by this on each side for the same reason. */
export const BACKFILL_CLOCK_SLACK_MS = 10 * 60 * 1000;
/** The Devices page's reading-rate window. Admin only; no alert, no
 *  email, by decision on 2026-10-02. */
export const READING_RATE_WINDOW_DAYS = 7;
/** Seconds the sensor waits between the frames of a long answer. */
export const DATALOG_REPLY_INTERVAL_S = 5;
/** Job name for a backfill request that could not be queued. */
export const JOB_BACKFILL = 'backfill';

// ── Watchdog ────────────────────────────────────────────────────────────────
// The alert sender runs every five minutes. Six missed runs is unambiguous — a
// slow run or a single blip will not trip it, and anything that has been quiet
// for half an hour is genuinely stopped rather than late.
export const ALERTS_HEARTBEAT_MAX_AGE_MS = 30 * 60 * 1000;

/** Key the alert sender stamps in `job_heartbeats`. */
export const ALERTS_JOB_KEY = 'alerts';

// ── Ingest ──────────────────────────────────────────────────────────────────
// How old a reading's own timestamp may be before ingest refuses it. Six hours
// is enough for ChirpStack to retry through an outage and not enough to rewrite
// history: the record is append-only and the past is not for re-filing.
export const MAX_READING_AGE_MS = 6 * 60 * 60 * 1000;

// ── Platform watchdog ───────────────────────────────────────────────────────
// How stale each stamp in `platform_status` may be before the admin card turns.
// The VPS pulses every minute, so ten minutes is ten misses — unambiguous, and
// far shorter than the 35 minutes a sensor gets, so the platform is always known
// to be down before any fridge could look silent because of it.
export const VPS_PULSE_STALE_MS = 10 * 60 * 1000;
/** The offline sweep runs every five minutes inside Postgres; three misses is late. */
export const JOB_RUN_STALE_MS = 15 * 60 * 1000;
/** The sender crosses the network to Supabase and drops a run now and then. It
 *  is delivery, not detection: half an hour without a good run is the honest
 *  bar for "something is wrong", and short of that a late email is the cost. */
export const SENDER_RUN_STALE_MS = 30 * 60 * 1000;
/** Job names written to `job_runs` and read back by the watchdog. */
export const JOB_SWEEP = 'sweep';
export const JOB_SENDER = 'sender';
export const JOB_WATCHDOG = 'watchdog';
/** Ingest writes a job_runs row only when a reading is lost, never on success. */
export const JOB_INGEST = 'ingest';
