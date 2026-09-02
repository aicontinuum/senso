# Senso Dev Log

Running record of what was built each session. Most recent first.

---

## 2026-09-02 — Comments: letting a supervisor explain an incident

A report showing 18 °C for two hours is a failing fridge. The same report
annotated *"cleaning the fridge, doors open"* is a well-run kitchen. There was
nowhere to say which, so every excursion read as the first kind.

`alert_comments` holds one note per alert, written on the alert page and
repeated against every out-of-range reading of that incident in a report.

### Decisions worth knowing

- **This is the safe half of the service-window idea**, and probably replaces
  it. A comment explains a breach; it does not suppress the alert or exclude a
  reading. Nothing here can hide anything — the readings, the breach and the
  alert all stand exactly as recorded.
- **No revision history.** Considered and dropped: auditors here trust the
  restaurant, and the machinery was not worth it. `updated_at` still moves, so
  the page can show "edited", but previous text is not kept.
- **Reports are generated live, never stored.** So a PDF printed before a
  comment was written keeps what it had, and regenerating picks up the current
  text. That is already how the Range column behaves — there is no snapshot to
  go stale.
- **One note per alert**, enforced by a unique constraint on `alert_log_id`. It
  makes "add" and "edit" one upsert instead of a race between two supervisors
  both adding a first comment.
- **Which alert a reading belongs to is derived, not stored.** `alert_logs`
  records when an alert opened but not when it closed. It does not need to: an
  episode is a contiguous run of breaching readings after a trigger, so a
  breaching reading takes the most recent note *of the same bound* at or before
  it. Two consecutive episodes resolve correctly because the second trigger is
  nearer, and in-range readings match nothing — there is no incident to explain.
- **`author_id` defaults to `auth.uid()`** rather than being sent by the client,
  and the column grants let a customer write only `alert_log_id` and `body`.
  Without that, a client could attribute a note to another user or back-date
  `updated_at` so an edit did not show as one.
- **No delete policy.** A note explaining an incident is part of that incident's
  record; removing it would leave the breach standing with its explanation gone.
  Editing to correct a mistake is enough.
- **A failed comment load does not block the report.** Readings, limits and
  verdicts must be right or the report must not exist — that refusal already
  exists. A missing note only costs context, and refusing to produce a
  compliance record because an explanatory comment would not load gets the
  priority backwards.

### Comments are not in the CSV

Deliberate. The CSV is a data extract for filtering and pivoting, and repeating
a sentence of free text across every row of a 118-reading episode makes it worse
at that job. It is also the one place customer-typed text could carry a
spreadsheet formula — `TODO.md` still carries the unfixed CSV escaping item, and
keeping comments out means this change does not make it any more exploitable.

The PDF is the compliance document and carries them, capped at two lines per row
with the full text on the alert page.

### Verified

Against a real PostgreSQL 16: a supervisor can add and edit a note; a second
note on the same alert is rejected; an empty one and one over 500 characters are
rejected; forging `author_id` on insert, back-dating `updated_at` to hide an
edit, reassigning authorship, and deleting the note are all **refused at the
database**. `created_at` does not move on an edit.

Plus 20 cases on the mapping: the trigger boundary, a reading before the
trigger, in-range readings, two consecutive episodes, min and max notes not
crossing over, an alert with no note not falling back to an older one, and
unparseable timestamps yielding nothing rather than a wrong answer.

One thing found while writing the tests: a policy's `exists (…)` subquery is
evaluated as the **caller**, so it needs the caller's own SELECT grants on
`alert_logs` and `alert_configs`. Production has them (customers read the alerts
page); a fixture without them fails in a way that looks like a broken policy.

### The bug the tests missed

Every comment save failed in production with "Could not save the comment."

`supabase.upsert()` compiles to `on conflict do update set alert_log_id = …,
body = …`, and PostgreSQL checks UPDATE privilege on **every column named in
that clause** whether or not the conflict path is taken. The grants give this
role UPDATE on `body` alone — deliberately, so a client cannot move a note onto
a different incident — so the statement was refused even when inserting a first
comment, on a table with no rows in it.

The tests exercised INSERT and UPDATE separately and both passed. Neither is the
statement the app sends. **Testing the policies is not the same as testing the
query**, and the gap between them is exactly where a column-scoped grant will
bite: the privilege model and the client library disagree about what one write
is.

Now a read followed by an insert or an update. One extra round trip, column
scope intact. The unique constraint still settles two supervisors racing to add
a first note — the loser gets a 23505 and retries as an edit.

---

## 2026-09-02 — Sensors are not in the record until someone says they are installed

### The problem

A sensor is registered in the admin app during office prep, then powered on for
the bench test — and from that moment its readings were attributed to the
customer exactly as if it were already in their fridge. It is sitting on a desk
in Doha reading 25 °C. Those readings reached their dashboard, alerted them, and
landed in their compliance report as a documented excursion that never happened.

An inspector reading that report sees a two-hour failure. The customer cannot
disprove it. And it is entirely our doing — the wrong data got there because of
how *we* commission hardware, not because of anything they did.

`ONBOARDING.md` step 7 has always said "mark the sensor active". That step had
never been built.

### The fix

`sensors.commissioned_at`, the mirror of `decommissioned_at` at the other end of
a sensor's life. Null means not in service. Readings are still stored — the bench
test depends on watching one arrive — but they raise no alerts and appear in no
report until a technician marks the sensor installed.

- `apps/customer/lib/commissioning.ts` — `inServiceReadings()` and
  `commissionedNote()`, the two rules that decide what counts.
- `POST .../sensors/[sensorId]/commission` — admin-only, both directions.
- `CommissioningPanel.tsx` — kept out of `SensorSettingsClient`, which is already
  over the 150-line guidance and edits how a sensor *behaves*; this changes what
  its history *means* and should not sit behind the same Save button as a rename.

### Decisions worth knowing

- **Backfill sets `commissioned_at = created_at` for every existing sensor**,
  retired ones included, so the migration changes no existing report by a single
  row. A migration that retroactively removed readings from a compliance record
  would be the exact failure this feature exists to prevent.
- **The default is out of service, and that fails in the right direction.** If a
  technician forgets to commission, the customer sees *no data* — loud, obvious,
  someone rings within the day. The old behaviour failed the other way: wrong
  data that looks entirely fine until an inspector reads it. Silent-wrong is far
  more dangerous than visibly-missing.
- **Uncommissioned sensors stay visible on the customer dashboard**, badged
  `Not in service`. Onboarding step 5 has the technician confirm a reading
  arrives while logged in as the customer, so hiding them would break the bench
  test.
- **Reports say what they excluded.** A sensor put into service mid-period prints
  *"Sensor put into service … — readings before this were taken before
  installation and are excluded"* on screen, in the PDF and in the CSV. A
  silently short report is exactly the kind of gap an inspector is entitled to
  ask about; the answer should already be on the page.
- **A never-commissioned sensor cannot be selected in the report picker at all**
  — it has no service history, only bench readings. It is still *listed*, greyed
  and labelled, because silently omitting a sensor the customer can see on their
  dashboard raises a different question.
- **`not-in-service` outranks `offline`** in `sensorState()`. A sensor still in
  its box is not offline in any sense worth showing as a fault.
- **Commissioning is one-way, and the UI offers no reverse.** It shipped with a
  "Take out of service" button and that was wrong. Two verbs for leaving service
  is one too many: **Unlink** already retires a sensor that really was in service
  and keeps its history in reports tagged "Retired". Un-commissioning means
  something else — *it was never in service, withdraw the record* — which is a
  correction for a mis-commission, not a lifecycle step, and rare enough that it
  does not belong on a button beside a rename.

  Removing it also removed two defects it had: a round trip lost the original
  commissioning date (re-commissioning stamps *now*, and the audit row recorded
  no previous value), and ingest's early return for an out-of-service sensor sits
  above the branch that resolves alerts, so an alert open at that moment would
  have stayed open indefinitely.

  The lifecycle is now **register → commission → retire**. A genuine
  mis-commission is an office-side SQL correction; `sensor_commissioning_events`
  still accepts an `uncommissioned` action, with its reason, so that correction
  can be recorded when it happens.
- **Ingest returns `notInService: true`** rather than pretending nothing
  happened, so a bench sensor's suppressed alerting is visible in the logs.

### The prerequisite that was not optional

`customers_update_own_sensors` is row-scoped but **not** column-scoped — a
customer could already write any column of their own sensor straight from
devtools (a standing item in `TODO.md`). Adding `commissioned_at` to that table
without fixing it would have handed every customer a switch that erases readings
from their own compliance report: set it forward a month and last month is gone.

That would have been strictly worse than shipping nothing, so the migration also
revokes table-wide UPDATE from `anon`/`authenticated` and grants only
`UPDATE (name)` — the one column the rename feature needs.

### Verification

Applied to a real PostgreSQL 16 against a fixture of the live schema:

- Backfill leaves zero uncommissioned sensors, retired ones included.
- A customer renaming their own sensor still **succeeds**.
- The same role writing `commissioned_at`, `decommissioned_at` or `hardware_id`
  is **refused** — permission denied, at the database, not in application code.
- The ordering constraint rejects a sensor retired before it was installed.
- The audit table rejects an un-commissioning with no reason, and a
  commissioning with no timestamp. (Both still enforced — the office-side
  correction writes through the same table.)
- A sensor with commissioning history cannot be hard-deleted.

Plus 18 cases against the real modules covering the boundary reading (`>=`, not
`>`), a never-commissioned sensor yielding nothing, unparseable timestamps
failing *closed* rather than admitting everything, the note appearing only when
readings were actually excluded and rendering in the customer's timezone, and
`not-in-service` outranking both offline and a live breach.

### Left undone, deliberately

**Gateways have the same gap.** A bench gateway assigned to a customer will still
be swept as offline and emailed about. The column and the sweep filter are nearly
identical; the UI is not, which is why it is in `TODO.md` rather than bundled
into a change that is already wide.

---

## 2026-08-29 — Alert charts show the episode, not a fixed window

The alert detail chart had three separate problems, all found by reading it on a
real alert.

**It drew only the bound that fired.** A "too low" alert showed the minimum line
and nothing else, so there was no way to see the safe band the reading had left.
Both bounds are passed now, with a tinted safe-range area between them; the
breached one is drawn in the alert tone and the other in the ok tone.

**Then the y-axis broke.** With both bounds in the scale, an alert on a sensor
configured 6–10 °C stretched the axis from −0.7 to 11.8 to fit a maximum the
readings never approached, flattening every reading into a band at the bottom.
Only the breached bound scales the chart now. The other is drawn when it happens
to land inside that scale and left out when it does not — a labelled reference
line silently clipped to nothing is what made the maximum look "missing" in the
first place.

**And the window was a fixed ±12 hours around the trigger** — about 96 readings,
nearly all unrelated, and a hard cut for any breach that outlasted it, with
nothing on screen saying so. `apps/customer/lib/alert-episode.ts` now trims the
series to the episode: the run of out-of-range readings plus two in-range
readings either side.

### Decisions worth knowing

- **Breaches are judged against the range in force when the alert fired**, not
  today's range and not per-reading history. That is the same pair the chart
  draws, so what trimmed the series and what the eye reads off it always agree.
- **Context stops at another breach**, not just at the end of the series. Two
  readings either side can otherwise reach into a *separate* episode: a sensor
  that dips, recovers for one reading and dips again would draw the next breach
  onto this alert's chart and count it in the "N readings out of range" line. At
  one reading either side this could not happen; at two it can.
- **Capped at 120 points** (30 hours at the 15-minute cadence). An open breach
  has no end — a week of one is 672 readings, a smear on the chart and a payload
  to match. The cap keeps the *onset*, never drops points from inside the range
  shown (so it cannot hide a spike), and the chart says when it has cut the rest
  short and points at Reports. A compliance chart that quietly omits a reading
  would be worse than one that is hard to read.
- The two constants — `ALERT_EPISODE_CONTEXT_READINGS`, `ALERT_EPISODE_MAX_POINTS`
  — are in `lib/constants.ts`, so changing either is one line.

Verified by running the real module (via `jiti`) over single-reading blips, long
runs, still-open breaches, a neighbouring breach in both directions, max-side
breaches, the cap, a series starting mid-breach, and an in-range trigger.

### The thing that looked like a bug and was not

An alert's chart read `Min: 6.0 / Max: 10.0` while the sensor card read
`1.0 – 3.0`, which looked badly wrong. It was correct: the threshold history had
a 6/10 version whose window covered the trigger instant, and the alert's own
subtitle ("Too low · 3.5 °C") could only be true against a minimum above 3.5.

The confusion was **UTC versus display time**. `alert_threshold_history` stores
`timestamptz`, so the SQL editor shows UTC; every screen renders `Asia/Qatar`,
three hours ahead. The alert's `19:54` on screen is `16:54` in the history table.
Worth remembering before concluding history has resolved wrongly — subtract three
hours from what the UI shows.

---

## 2026-08-29 — One rule for a sensor's state

The dashboard card showed "Alert" while the sensor's own page showed "Online",
for the same sensor at the same moment. Two views were each deriving state from a
different mix of `sensors.status`, the latest reading and open `alert_logs`, so a
breach that had recovered but whose alert row was still open landed differently
in each.

`apps/customer/lib/alert-state.ts` now holds the single rule, in priority order:

```
offline  →  breaching  →  alert-open  →  ok
```

`alert-open` is deliberately its own state rather than being folded into
`breaching`: the reading is back in range but the incident has not been closed
out, and flattening that to "ok" would hide an unresolved alert.

---

## 2026-08-29 — Email alerting, end to end

Breaches were recorded but nobody was told. `supabase/migrations/20260829_alert_notifications.sql`
plus `apps/admin/app/api/cron/alerts/route.ts` close that.

**When it fires.** Two jobs run on one endpoint. A sweep raises alerts for
silence — a sensor that has stopped reporting, or a gateway that has — which
threshold evaluation can never catch, because a dead sensor sends nothing and no
code runs. A sender then emails whatever is due.

**The schedule is immediate, +30 minutes, +2 hours, then quiet** until the alert
resolves. No all-clear email and no quiet hours, both by decision: an operations
inbox does not need a "nothing is wrong now" message, and a fridge failing at
3 a.m. is exactly when someone must be woken.

### Decisions worth knowing

- **`notifying_at` is a lease, not a flag.** A sender claims a row by stamping
  it and clears it only once the send succeeded; a run that dies mid-send leaves
  a stale lease that becomes claimable again after five minutes. Incrementing
  the count up front would have been simpler but would burn a reminder slot on a
  failed send — for a fridge alert a missed notification is worse than a
  duplicate.
- **Double-send is prevented in the database, not the application.**
  `claim_due_alerts()` uses `for update skip locked`, so two overlapping cron
  runs skip each other's rows instead of both sending. PostgREST cannot express
  row locking, which is why claiming is a `SECURITY DEFINER` function rather
  than a query.
- **One row per incident.** Partial unique indexes enforce one open alert per
  config / per offline sensor / per offline gateway. Previously a persistent
  breach resolved and re-opened every 30 minutes, so a six-hour problem became
  twelve rows in the history — and would have become twelve emails.
- **A gateway going offline suppresses its sensors' individual alerts.** One
  site-level email, not one per fridge.
- **`emailConfigured()` releases every claim rather than counting sends.** With
  no API key the alerts stay due instead of being marked as notified, so
  mis-configuration delays alerting rather than silently swallowing it.
- **Customer timezone is stored, never inferred.** `customers.timezone` is
  passed into the email renderer as a required argument with no default, so a
  server in UTC cannot quietly render Qatar times three hours off. Verified:
  `11:41Z` → `14:41` Asia/Qatar, `07:41` America/New_York.
- **Resend over a thin `fetch` wrapper**, not the SDK — one POST, no dependency,
  10-second timeout so a hung provider cannot hold the run open until the
  platform kills it and strands every claimed lease.
- Failures log server-side only; Resend's error body can echo recipient
  addresses.

### Applying it

The same partial-apply trap as the threshold migration: pasted whole, the three
`$$`-quoted functions silently did not create, with no error. Run it in blocks
and verify explicitly:

```sql
select proname from pg_proc
 where proname in ('claim_due_alerts','mark_alerts_notified','release_alert_claims');
```

Three rows, or the sender will claim nothing and send nothing while looking
healthy.

### Verification

The migration was applied to a real local PostgreSQL 16 and six scenarios were
run against it: it applies clean, both unique indexes reject duplicates, the
kind constraint rejects mismatched references, two concurrent claimers overlap
on nothing, the `[immediate, +30 min, +2 h]` schedule sends exactly three times
and then stops, and an expired lease makes an alert claimable again without
counting a send.

Then proven in production — a real breach produced a real email.

---

## 2026-08-29 — Production domains, and the scheduler moved to the VPS

**`app.sensoqa.com`** (customer) and **`admin.sensoqa.com`** (admin) are live on
Vercel with DNS at Cloudflare. Docs and the forwarder point at them rather than
at `*.vercel.app` deployment URLs.

Supabase's URL configuration had to change with them — Site URL and the redirect
allowlist. Two entries there were typo'd onto domains we do not own; an auth
redirect allowlist pointing at someone else's domain is an open-redirect handoff
of a session, so they were corrected before anything else.

**Alert cron runs from the ChirpStack VPS, not Vercel Cron.** Vercel's Hobby
plan caps cron at once per day, which is meaningless for a fridge alert — and
worse, the rejected `*/5` schedule *failed the build*, so production stayed
pinned to an older deployment and `/api/cron/alerts` returned 404 while existing
in the source. The crontab entry and its root-only secret file are documented in
`network-server/README.md`.

The endpoint only checks its bearer token and does not care who calls it, so
moving back to Vercel Cron later is a `vercel.json` entry and deleting one
crontab line.

**This makes the VPS load-bearing for alerting as well as ingest.** If it goes
down, breaches are still recorded but nobody is told.

---

## 2026-08-29 — Editable sensor names, and a device ID that outlives them

Customers can rename their own sensors. That immediately raises a compliance
problem: a report identifying a fridge only by a name the customer can change is
not traceable — rename it and last month's record now refers to something that,
on paper, no longer exists.

So reports and the sensor page also carry the **device ID**: the DevEUI, the
LoRaWAN identity assigned at manufacture and fixed for the life of the hardware,
displayed in groups of four.

### Decisions worth knowing

- **The DevEUI is an identifier, not a credential.** Joining the network needs
  the AppKey (on the device label's QR code, never in this system) and posting a
  reading needs the ingest secret. Showing it grants nothing.
- **It identifies the *device*, not the monitoring point.** Replacing a failed
  sensor starts a new identity in the record. That is the honest outcome —
  those readings did come from a different instrument.
- **Name validation is an allowlist, not a blocklist**, and shared between the
  field and the API so the client copy is convenience while the server stays the
  authority. It permits any script (Arabic included — these are Qatar sites) and
  the punctuation of real equipment names, plus typographic quotes, because iOS
  autocorrect turns "Chef's fridge" into a curly apostrophe and rejecting that
  would be baffling.

---

## 2026-08-29 — The Senso design system, applied to both apps

Both apps ran a default shadcn-style theme with no relationship to the brand, and
**104 hardcoded palette classes** (`text-red-600`, `bg-green-500`, `bg-zinc-400`
…) that bypassed tokens entirely — carrying exactly the states operations staff
read at a glance. Plan in `.claude/plans/cuddly-crunching-sundae.md`.

- **`packages/tokens`** — the design system's CSS vendored verbatim, so a future
  export can be diffed rather than re-merged by hand.
- **`packages/ui`** — the app shell (`AppShell`, `Sidebar`, `Header`, `Logo`,
  `nav`, `cn`, `Spinner`, `Skeleton`), previously duplicated in both apps and
  already drifting.
- Status colours became the five-tone vocabulary: `ok`, `warn`, `alert`, `cold`,
  `offline`, each with `-500 / -soft / -border / -text`.
- Fonts come from `next/font` (Poppins, Plus Jakarta Sans, JetBrains Mono), not
  the design system's render-blocking Google Fonts `@import`.
- Components were ported to Tailwind utilities rather than dropped in, because
  the design system ships inline `style={{}}` objects and `CLAUDE.md` forbids
  them. Accepted cost: a future export needs re-porting.

### Gotchas worth not rediscovering

- **Unlayered CSS beats layered CSS regardless of specificity.** Left unlayered,
  the design system's `input:focus-visible { box-shadow }` outranked
  `focus-visible:shadow-none`, and its `a { color }` would have done the same to
  every text utility. Importing the tokens with `layer(base)` makes them
  defaults that utilities can override, which is what they should be.
- **Tailwind v4 wants `h-(--var)`, not `h-[--var]`** — the bracket form silently
  generates no CSS. Caught by grepping the built stylesheet, not the source.
- **Order longest-first when bulk-replacing class names.** `bg-green-50` ran
  before `bg-green-500` and produced `bg-ok-soft0` on nine status dots.
- `@source "../../../packages/ui"` is required or classes used only inside the
  shared package never generate. Verified by planting a package-only class and
  confirming it reached the built CSS.
- Static assets 307-redirected to `/login` until `proxy.ts`'s matcher excluded
  image extensions.

Also in this pass: temperatures fixed to one decimal everywhere including
reports, chart axis ticks left as plain numbers, the sidebar sized by the
viewport, and the logo cropped **at the source SVG** — its `viewBox` was
`0 0 1877 1783` while the artwork occupied 1159×210 of it, so it rendered ~3 px
tall. Fixed in the file rather than compensated for in CSS.

---

## 2026-08-29 — Effective-Dated Alert Thresholds

### The bug

Changing a sensor's minimum from 1°C to 1.5°C and regenerating a report marked
*past* readings as "Out of range" — readings that never alerted and that nobody
was ever notified about. `alert_configs.threshold` was edited in place, and the
report recomputed all history against the current value.

The reverse direction was the more serious one: raising a threshold back up made
genuine past violations disappear from every future report, with no trace. For a
compliance product that is a one-click way to erase evidence, and nothing in the
UI would reveal it had happened.

The same root cause hit `alerts/[id]`: an old alert resolved its threshold
through `alert_config_id`, so it reported today's number as the one that fired it.

### The fix

`supabase/migrations/20260829_threshold_history.sql` adds
`alert_threshold_history` (effective-dated versions, one open row per config)
maintained by an `after insert or update of threshold` trigger on
`alert_configs`. A trigger rather than app code because thresholds are written
from three places — the customer API, the admin API, and the SQL console — and
only the database sees all three.

`alert_configs.threshold` stays as the current value, so ingest, the dashboard
and the admin views are untouched. Only the report and the alert page resolve
history.

- `apps/customer/lib/thresholds.ts` — resolves the version covering a reading's
  `recorded_at`.
- The report drops its `alert_configs` fetch entirely and loads history in
  `generate()`, so no path remains where it can read today's number.
- New **Range** column in all three outputs (screen, PDF, CSV), showing the
  limits that applied to each row.
- Header line reads `Threshold: changed during this period — see Range column`
  when it changed mid-period, instead of stating one value that is wrong for
  part of the range.

### Decisions worth knowing

- **Backfill uses `-infinity`**, so pre-migration readings are judged by today's
  threshold — the exact behaviour being removed, accepted once because those are
  test runs. From the migration forward it cannot recur.
- **No covering version now yields "No limit set"**, not a verdict. Previously
  the report fell back to a hardcoded 2–8°C, which put a fabricated limit into a
  compliance record for sensors that had no config at the time.
- **Half-open windows** — the instant a version is replaced belongs to its
  successor, so contiguous versions never both match.
- `clock_timestamp()`, not `now()`: `now()` is fixed per transaction, so two
  edits in one transaction would produce a zero-width window and trip the check
  constraint.
- Postgres serialises `-infinity` as a string that `new Date()` reads as
  `Invalid Date`, silently matching no version. `lib/thresholds.ts` maps it
  explicitly.
- RLS reuses the existing `customer_owns_sensor()` helper rather than
  re-deriving the sensor → gateway → customer chain.

### Applying it — read this before running the migration anywhere else

Pasting the whole file into the Supabase SQL editor ran only as far as the table
and indexes. Everything after it — the trigger function, the trigger, the
backfill, RLS and the grant — silently did not apply, with no error surfaced.
The likely cause is the `$$`-quoted function body: a client that splits
statements on `;` mangles it, and the rest of the script goes with it.

Run it in blocks: (1) table + indexes, (2) function, (3) trigger, (4) backfill,
(5) RLS + policy, (6) grant. Then verify rather than assume:

```sql
select to_regclass('public.alert_threshold_history');                    -- table
select count(*) from alert_threshold_history;                            -- = count(alert_configs)
select tgname, tgenabled from pg_trigger
  where tgname = 'alert_configs_threshold_history';                      -- one row, tgenabled = O
select policyname from pg_policies
  where tablename = 'alert_threshold_history';                           -- the select policy
select grantee, privilege_type from information_schema.role_table_grants
  where table_name = 'alert_threshold_history' and privilege_type = 'SELECT';
```

The partial apply was hard to spot from the UI: with no SELECT grant the report
showed "No limit set" on every row rather than failing, because `generate()`
discarded the query error. Fixed in `1c48863` — a failed load, or an
`alert_config` with no versions, now refuses to generate and says so. A report
built from a failed query is worse than no report.

A working install shows one open version per config. Rows staying at
`-infinity` with `effective_to` null after a threshold edit means the trigger
did not install — the report still looks entirely normal in that state, so it
is worth checking explicitly rather than inferring from the UI.

---

## 2026-08-27 — LoRaWAN migration (Phases 0–3, 5) + stopping deletion from destroying history

Two threads: finishing the hardware pivot onto off-the-shelf LoRaWAN, and a critical
data-integrity fix found along the way. Full migration tracker in `MIGRATION.md`.

### The pivot — raw LoRa → LoRaWAN
The end product moves off the ESP32/Pi prototype onto **SenseCAP M2 gateway + Dragino
LHT65N-E3 sensors (EU868)**. The structural change: the gateway is now a dumb radio bridge
and a **LoRaWAN Network Server sits in the middle**, so our integration point moves from
"the Pi forwarder POSTs to us" to "ChirpStack delivers decoded uplinks to us." The whole
web platform is backend-agnostic and carried over untouched.

- **Network server: self-hosted ChirpStack** on a Hostinger VPS (Mumbai, Ubuntu 24.04),
  Docker, fronted by Caddy with Let's Encrypt at **lns.sensoqa.com**. Ruled out free TTN
  (no SLA/control) and The Things Stack Cloud (~$200/mo). Managed ChirpStack (~€35/mo flat)
  stays an easy fallback — same software, no rebuild. Ops doc: `network-server/README.md`.
- **Gateway online** — SenseCAP M2, EUI `2cf7f11081400088`, packet-forwarder mode → port
  1700. *Field learning:* configuring its WiFi over its own hotspot always fails (you're
  reconfiguring the link you're using); connect on Ethernet first. Technicians should carry
  a cable even for WiFi-only sites.
- **First sensor joined and decoding** — `sensor0`, DevEUI `a840419edb62011c`, OTAA, EU868,
  official Dragino **ChirpStack v4** decoder (v3 decoders throw `UPLINK_CODEC` errors).
  Ice-water accuracy check passed.
- **ADR matters more than interval for battery** — the device moved DR0/SF12 → DR5/SF7
  within three uplinks. SF12 burns far more per transmit than SF7, so **gateway placement
  affects battery life more than reporting cadence.** Added to the technician checklist.
- **15-minute interval, standard on every sensor** (the earlier 20/15/10 per-customer tier
  idea was dropped). Devices ship at 20 min and are moved by downlink `01000384` on fPort 1
  during office prep — verified working: 20:00 spacing until the `txack`, then 15:02.
- **Schema ready (Phase 5)** — `readings` gained `humidity`, `battery_v`, `rssi`, `snr`,
  `spreading_factor`. Two checklist items needed no DDL at all: `gateways.mac_address` was
  already EUI-native, and `hardware_id` is a text column so DevEUI is just different text.
  Battery had to go on `readings`, not `sensors.battery_level` — that field is a snapshot in
  0–100 *percent* while `BatV` is *volts*, so it could neither hold the value nor give
  history.
- **Phase 4 (ingest rewrite) is the only step left.** Payload contract captured in
  `network-server/UPLINK-FORMAT.md`.

### 🔴 Fixed: deleting a sensor destroyed its entire history
Found while checking whether the retired ESP32 test sensor could be deleted safely.
`readings_sensor_id_fkey` was **ON DELETE CASCADE**, and the admin app hard-deleted
sensors — including *every sensor on a gateway* when a gateway was unlinked. One click
permanently erased all readings for those sensors, with no warning about readings and no
undo. The FK audit then found the same exposure on `alert_logs` (via both `alert_configs`
and `readings`) — which would have destroyed the proof a customer *was notified* when a
fridge failed.

**Rule established: history tables (`readings`, `alert_logs`) never cascade-delete;
structure/config tables (`gateways`, `sensors`, `alert_configs`) may.** Enforced in the
database, not just app code.

- All three history FKs → `RESTRICT`.
- `decommissioned_at` on `sensors` + `gateways`; both admin delete routes now soft-delete.
- Every live read path filters retired devices (both dashboards, sensor detail, settings,
  alerts, sensors API); ingest and heartbeat reject retired hardware.
- **Reports deliberately still list retired sensors**, tagged "Retired" and unselected by
  default, with the retirement date on screen/PDF/CSV. Hiding them everywhere had preserved
  the history but made it unreachable — which defeats the point.

### Decisions recorded
- **Tenancy:** ChirpStack **tenant = customer, application = branch**. Implies a future
  `sites` table (`customers → sites → gateways/sensors`).
- **Alert confirmation (designed, not built):** don't alert on one bad reading. Preferred
  model is a **sustained-breach rolling window** (≥2 bad readings, not cleared by a run of
  good ones) rather than "any good reading resets" — the latter misses a fridge flickering
  in and out of range. Confirmation comes from the base interval, *not* an on-demand
  downlink: Class A downlinks aren't guaranteed and cost battery.
- **Battery: measure, don't trust the spec.** Track `BatV` per uplink and derive real fleet
  life rather than quoting Dragino's best-case 8–10 years. Replace threshold ≈ **2.6 V**.
- **Data retention: deliberately deferred.** A 5-month auto-delete was proposed and
  rejected — food-safety regimes generally require 1–2 years, so it risked *causing* the
  compliance failure the product prevents. Storage isn't the pressure (~2 MB/sensor/year).
  It's a pure backend job, shippable any time, and keeping data is reversible while
  deleting it is not. Design notes in `TODO.md`.

### SQL run this session (Supabase)
- `readings`: added `humidity`, `battery_v`, `rssi`, `snr`, `spreading_factor`
  (`supabase/migrations/20260827_lorawan_readings.sql`).
- `readings_sensor_id_fkey` → `RESTRICT`; `decommissioned_at` on `sensors` + `gateways`;
  partial active-device indexes (`..._sensor_soft_delete.sql`).
- `alert_logs_alert_config_id_fkey` and `alert_logs_reading_id_fkey` → `RESTRICT`
  (`..._protect_alert_history.sql`).
- Verified `readings_sensor_time_uniq` already existed — not re-created.

### Carried forward
CRA type approval for EU868 in Qatar · the Docker-bypasses-ufw audit on the VPS ·
resilience gaps (DB backups, VPS snapshots, uptime monitor) · Qatar trademark clearance ·
RLS verification (still 🔴 in `TODO.md`) · the retention job, which **must delete a
period's `alert_logs` before its `readings`** or the new RESTRICT will block it.

---

## 2026-07-04 — Live pipeline: timezones, offline detection, and a production-grade gateway

Big session. Took the platform from "mock/early-live" to a secure, self-healing, gap-free hardware-to-dashboard pipeline, and built a reusable gateway provisioning kit.

### Customer app (`apps/customer`)
- **Customer-selectable timezone.** New `lib/timezones.ts` (curated Gulf list, default `Asia/Qatar`). Settings gets a `TimezoneSection.tsx` dropdown that auto-saves via `/api/account` → stored on `customers.timezone`. Every timestamp now renders in the chosen zone — dashboard, sensor detail (incl. chart), alerts, gateway "last seen", and reports (with an explicit "All times shown in …" stamp on screen/PDF/CSV/email). `formatReadingTime` / new `formatDateTimeLong` in `lib/temperature.ts` take a timezone and are null-safe. Replaced the old inconsistent mix (UTC report headers vs browser-local rows).
- **Recent Readings chart** on the sensor detail page (recharts) — last 5 readings below the current reading, with dashed min/max threshold lines. (Fixed the initial bug where colors used `hsl(var(--primary))` but the app's tokens are oklch → invisible; now uses the CSS vars directly.)
- **Auto-refresh** — `components/auto-refresh.tsx` re-fetches every 5 min + on tab focus (dashboard + sensor detail) so live data stays current without a manual reload.
- **Freshness-based offline detection** — `lib/status.ts`: gateway Offline after **5 min** of silence (`GATEWAY_STALE_MS`), sensor after **35 min** (`SENSOR_STALE_MS`), derived from `last_seen_at` / latest-reading time rather than the `is_online`/`status` flags (a silently-dead device never updates those). Applied across dashboard, sensor detail, settings.
- **Error boundaries** — added `app/(dashboard)/error.tsx` + `not-found.tsx` (branded) so a server throw degrades gracefully instead of the bare Next.js page.
- **`requireCustomer()`** in `lib/supabase/get-customer.ts` — replaces the duplicated `getCustomer() + redirect('/login')` across the 6 dashboard pages; redirects to `/login?error=session` (error param) so a failed customer lookup can't infinite-loop against the middleware.

### Backend / ingest pipeline (`apps/admin`)
- **Idempotent ingest** — `/api/ingest` now upserts readings `onConflict: sensor_id,recorded_at` + `ignoreDuplicates`, and skips alert re-eval on a duplicate re-send. Backed by a `UNIQUE(sensor_id, recorded_at)` index. Makes store-and-forward re-sends safe and eliminates duplicate rows. (Also fixed a double-count bug where `accepted` reported `2` for one reading — a leftover `accepted++`.)
- **Heartbeat endpoint** — `/api/heartbeat`: lightweight liveness pulse that stamps `gateways.is_online` + `last_seen_at`, decoupled from the (slower) temperature cadence.
- **Per-gateway secret auth** — `lib/gateway-auth.ts` (constant-time Bearer check). `/api/ingest` and `/api/heartbeat` require `Authorization: Bearer <secret>` verified against `gateways.secret`. Rollout-safe: enforced only when a secret is set (missing column/null → not enforced). **Go-live TODO: make strict + ensure every gateway has one.**
- **EUI identifier support** — shared `lib/gateway-id.ts`: accepts the 16-hex LoRa concentrator EUI as the primary gateway id, plus legacy colon-MAC.

### Gateway provisioning kit — NEW `gateway/` folder (version-controlled; one `sudo ./setup.sh`)
Runs on a Raspberry Pi + NetworkManager. Installs:
- `wifi-powersave-off.conf` — disable Wi-Fi power-save (top Pi Zero 2W drop cause)
- Wi-Fi autoconnect with unlimited retries (nmcli, in setup.sh)
- `net-watchdog.sh` + `.timer` — ping-based network watchdog (force-reconnect → restart NetworkManager → reboot)
- `heartbeat.sh` + `senso-heartbeat.timer` — 60s liveness pulse (sends the secret)
- `senso_forwarder.py` + `senso-forwarder.service` (`Restart=always`) — Semtech UDP packet-forwarder listener with **store-and-forward**: durable SQLite queue (`/var/lib/senso/queue.db`), decoupled receive/sender threads, content-window dedup of the concentrator's multi-channel double-reports, flush-on-reconnect with original timestamps (no report gaps), and 401 = keep-and-retry (never drops on an auth error). Sends the secret.
- `watchdog.conf` + `dtparam=watchdog=on` — hardware watchdog; resets a fully-frozen Pi (the one case the software watchdog can't)
- `gateway.env.example` → `/etc/senso/gateway.env` — per-gateway config (`GATEWAY_MAC` EUI, `API_BASE`, `GATEWAY_SECRET`); setup.sh auto-generates the secret and prints the SQL to register it
- `README.md` — install / verify / tune

### Firmware (ESP32 — not in this repo)
- Fixed: the sketch read temperature once in `setup()` and retransmitted a frozen value. Moved the sensor read + payload build inside the transmit loop so every reading is live.

### SQL run this session (Supabase)
- `ALTER TABLE customers ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Qatar';`
- Readings RLS: `GRANT SELECT ON readings TO authenticated;` + `CREATE POLICY customers_select_own_readings ON readings FOR SELECT TO authenticated USING (customer_owns_sensor(sensor_id));` + `GRANT SELECT ON alert_logs TO authenticated;`
- Dedup + `CREATE UNIQUE INDEX readings_sensor_time_uniq ON readings(sensor_id, recorded_at);`
- `ALTER TABLE gateways ADD COLUMN IF NOT EXISTS secret text;` + per-gateway `UPDATE gateways SET secret='<64-hex>' WHERE mac_address='<EUI>';`

### Debugging war stories (so we don't re-chase them)
- **Null timezone → crash / redirect loop.** Adding `customers.timezone` without a backfilled `NOT NULL DEFAULT` fed `null` into `Intl.DateTimeFormat` (crash), then a missing column made `getCustomer()` return null (login↔dashboard redirect loop). Fixed by the coercion + `requireCustomer()`, and the correct one-line migration.
- **"Duplicate readings"** was two separate things: real dup rows from the concentrator's multi-channel reports (fixed by content-dedup + unique index) and a phantom `accepted: 2` from a double-count bug (fixed). Data was never actually duplicated.
- **Secret-mismatch saga.** The env file predated the auth feature so it had no `GATEWAY_SECRET` line; a `sed -i` can't append a missing line. Store-and-forward held every reading through ~20 min of 401s and backfilled them once the env + DB secret matched — a real-world proof of the buffering.

### Net result
Secure (per-gateway secret) · self-healing (network + hardware watchdogs, autoconnect, `Restart=always`) · gap-free (store-and-forward) · duplicate-free (dedup + unique index) · live UI (auto-refresh, freshness-based offline, timezone-correct timestamps). Open pre-launch items tracked in `TODO.md`.

---

## 2026-05-31 — Ingest API + Gateway Simulator

### What was built

**`apps/admin/app/api/ingest/route.ts`** — new public POST endpoint  
The Raspberry Pi (or simulator) posts readings here. No user auth; devices authenticate by MAC address.

- Reads batch: marks gateway online, inserts readings, updates sensor status, runs alert logic
- Offline signal: marks gateway + its sensors offline
- Alert logic: creates an `alert_logs` row on threshold breach; 30-minute cooldown before creating a repeat alert for the same sensor/config; auto-resolves alert when temperature returns to range
- Returns `{ accepted: N, skipped: N }` (skipped = hardware_id not registered)

**`scripts/simulate.mjs`** — dev tool script (no new dependencies)  
Mimics a Raspberry Pi gateway sending readings to the ingest API.

```bash
npm run simulate              # continuous, every 10s
npm run simulate -- --once    # one shot and exit
npm run simulate -- --offline # send offline signal and exit
npm run simulate -- --spike 0 # sensor 0 sends baseTemp+10 (triggers max alert)
npm run simulate -- --drop 0  # sensor 0 sends baseTemp-10 (triggers min alert)
```

Config block at top of the file — edit `GATEWAY_MAC` and `SENSORS` to match what's registered in the admin UI. Overridable via env vars (`INGEST_URL`, `GATEWAY_MAC`, `INTERVAL_MS`).

**`apps/admin/proxy.ts`** — middleware matcher fix  
The auth middleware was catching all routes including `/api/*`, causing the ingest API to return HTTP 307 "Redirecting..." for unauthenticated requests. Fixed by adding `api/` to the exclusion pattern:
```
matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)']
```
All admin API routes (`/api/customers`, etc.) already do their own auth checks, so excluding them from the middleware is safe.

**`TODO.md`** — added pre-launch security note  
Ingest API currently authenticates by MAC address alone. Before go-live: replace with HMAC-signed payloads or a per-gateway shared secret header.

### SQL run by user (Supabase)

Readings RLS — lets customers read their own sensor data:
```sql
GRANT SELECT ON TABLE readings TO authenticated;

CREATE POLICY customers_select_own_readings ON readings
  FOR SELECT TO authenticated
  USING (customer_owns_sensor(sensor_id));

GRANT SELECT ON TABLE alert_logs TO authenticated;
```

### How to use the simulator end-to-end

1. Admin UI: create customer → link gateway (enter MAC) → add sensors (enter hardware IDs)
2. Run: `npm run simulate` from repo root
3. Customer dashboard shows live temperature + Online badge
4. Run `npm run simulate -- --spike 0` → alert appears in `/alerts`, dashboard count rises
5. Switch back to normal → alert auto-resolves
6. Run `npm run simulate -- --offline` → dashboard shows Offline badge

---

## 2026-05-30 — RLS Fix + Admin Cleanup

### What was fixed

**`alert_configs` permission denied error**  
Customers couldn't save threshold changes. Root cause: the `customer_owns_sensor` SECURITY DEFINER function existed but the `authenticated` role had no GRANT on `alert_configs` or execute permission on the function.

SQL run to fix:
```sql
GRANT SELECT, INSERT, UPDATE ON TABLE alert_configs TO authenticated;
GRANT EXECUTE ON FUNCTION customer_owns_sensor(uuid) TO authenticated;
```

### What was removed

**"Alert Thresholds" card from admin customer detail page**  
Removed from `apps/admin/app/(dashboard)/customers/[id]/CustomerDetailClient.tsx` and the corresponding query from `page.tsx`. The card added no useful information for admin ops staff.

---

## Pre-Launch Checklist (from TODO.md)

- [ ] **Secure ingest API** — replace MAC-only auth with HMAC or per-gateway shared secret
- [ ] **Rate limit `/api/ingest`** — no rate limiting today; could be spammed
- [ ] **Add temperature range validation on ingest** — reject obviously invalid values (e.g. 9999°C)
- [ ] **Tighten `customers_update_own_record` RLS** — restrict to only `contact_name`, `phone`, `alert_recipients` columns
