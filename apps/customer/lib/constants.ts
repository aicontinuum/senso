export const APP_NAME = "Senso";

export const TEMP_UNIT = "°C";

// Every temperature renders to a fixed 2 decimal places — including whole
// numbers, which show as "3.00". Readings sit in columns and update in place, so
// a varying decimal count makes them jump and misalign; a compliance record also
// reads as more precise when the precision is stated consistently.
export const TEMP_DECIMALS = 1;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Alerts", href: "/alerts" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
] as const;

// ── Alert detail chart ──────────────────────────────────────────────────────
// How far before the trigger to fetch, so the last in-range reading before the
// breach is on hand even if the sensor had a gap. Readings arrive every 15
// minutes, so six hours is 24 readings — nearly all of them trimmed away again.
export const ALERT_EPISODE_LEAD_MS = 6 * 60 * 60 * 1000;

// In-range readings kept either side of the breaching run. One would do to show
// where the line crossed the limit, but two gives the eye a direction to read it
// against — whether the sensor was already drifting before the breach and
// whether it settled afterwards or bounced. At 15-minute readings that is half
// an hour of context each way.
export const ALERT_EPISODE_CONTEXT_READINGS = 2;

// Ceiling on plotted points. A breach that is still open has no end, and at 15
// minutes a week of it is 672 readings: a smear on an 800px chart and a payload
// to match. 120 points is 30 hours, which covers any episode anyone will act on;
// past that the chart says it is showing the start and Reports holds the rest.
// Truncation always keeps the onset — the part that shows how fast it went
// wrong — and never drops points from inside the range shown, so a spike can
// never be hidden by it.
export const ALERT_EPISODE_MAX_POINTS = 120;

// Extra rows fetched beyond the cap, covering the lead-in readings that get
// trimmed away. Without it a sensor reporting frequently could spend the whole
// limit on the six hours before the alert and reach the breach with nothing left.
export const ALERT_EPISODE_FETCH_SLACK = 64;

// ── Incident comments ───────────────────────────────────────────────────────
// A supervisor's note explaining one alert — "cleaning the fridge, doors open".
// Long enough for a sentence or two of context, short enough to sit in a report
// table cell without swamping the reading it explains. Enforced here, in the API
// and by a check constraint on the column.
export const ALERT_COMMENT_MAX_LENGTH = 500;

// How many past alerts a report loads to resolve its Comment column. An episode
// spanning the start of the period is explained by a trigger that falls outside
// it, so the query cannot be bounded by the period — it is bounded by count
// instead. 500 is every alert a real customer has ever had, several times over.
export const REPORT_ALERT_LOOKBACK = 500;

// A note repeats on every reading of its incident, so the PDF caps it at two
// lines. The full text lives on the alert page; a long note wrapping over five
// lines on a hundred consecutive rows would bury the readings it explains.
export const COMMENT_PDF_MAX_LINES = 2;

// How many readings to show before an offline gap. Enough to see the shape a
// fridge was in just before its sensor went quiet, which is the first thing
// anyone asks about a silent sensor.
export const OFFLINE_ALERT_LAST_READINGS = 8;
