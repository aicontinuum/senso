# Senso — Project Bible

## What is Senso?

Senso is an IoT-based temperature monitoring SaaS platform targeting the Qatar market. It replaces manual pen-and-paper temperature logging for regulated industries like restaurants, pharmacies, flower shops, and laboratories.

Hardware logs temperatures automatically → cloud stores and processes readings → customers view live data, receive alerts, and generate printable Monitoring Reports via a web dashboard.

---

## Business Model

- **Pricing currency:** QAR (Qatari Riyal)
- **Billing:** Manual invoicing only — no payment gateway integrated. Admin portal tracks billing status only.
- **Billing statuses:** Active / Overdue / Suspended
- **Onboarding:** White-glove only. A Senso technician physically visits the customer site, installs the gateway and sensors, logs into app.sensoqa.com using the customer's credentials (no separate technician role), links the gateway, names sensors, sets alert thresholds and email recipients, then hands credentials to the customer.
- **Notification channel:** Email only (no SMS, no push notifications)

---

## Hardware Stack

Off-the-shelf **LoRaWAN**, as of the 2026-08 migration (see `MIGRATION.md`).

```
Dragino LHT65N-E3  (LoRaWAN sensor, external −40 °C probe)
        ↓  LoRaWAN, EU868 — body + antenna outside, probe inside the fridge
SenseCAP M2 gateway  (one per customer site; a dumb radio bridge)
        ↓  Semtech UDP packet forwarder, port 1700
ChirpStack  (self-hosted network server — lns.sensoqa.com)
        ↓  HTTP integration, shared-secret header
Vercel /api/ingest → Supabase
        ↓
app.sensoqa.com (customer dashboard)
```

- **Sensor type:** Temperature is the product. The LHT65N also reports humidity and
  battery voltage, which we store — but do NOT build features around humidity yet.
- **Reporting interval:** 15 minutes, standard on every sensor. Devices ship at a 20-min
  default and are moved to 15 by a downlink (`01000384`, fPort 1) during office prep.
- **One gateway per customer location.** Gateway choice is backend-invisible — ChirpStack
  normalizes every gateway's uplinks — so a different model can be used per site.
- **The Network Server is a real dependency.** Unlike raw LoRa, the gateway cannot talk to
  our backend directly; ChirpStack decrypts and decodes first. Ops details in
  `network-server/README.md`, payload contract in `network-server/UPLINK-FORMAT.md`.

**Prototype stack (removed 2026-09-08):** ESP32 + DS18B20 over raw LoRa into a Raspberry
Pi forwarder. The kit, its `/api/heartbeat` liveness endpoint and the `gateways.secret`
column it authenticated with are gone from the repo and the schema; `MIGRATION.md` has
the history.

---

## Two Sites

Production domains, both on Vercel with DNS at Cloudflare (proxy off — Vercel
terminates TLS itself). Sessions are host-scoped, so the two sites share no auth
context, which is the separation this project requires.

### 1. app.sensoqa.com — Customer-Facing

Read-mostly. Customers view their data, configure alerts, and generate reports.

**Pages:**

| Page | Purpose |
|------|---------|
| Dashboard | Live temperature readings across all sensors, with status indicators |
| Alerts | Configure temperature thresholds and email recipients per sensor |
| Reports | Generate and print Monitoring Reports (date range selector, sensor selector) |
| Settings | Sensor names, gateway status, account info |

**Key rules:**
- Customers do NOT add or delete sensors — that's done by the technician during onboarding
- Customers CAN rename sensors, set alert thresholds, and manage email recipients
- All data shown reflects the customer's own sensors only (scoped per account)

---

### 2. admin.sensoqa.com — Internal Operations (Admin)

Write-heavy. Senso staff manage customers, devices, and billing.

**Pages:**

| Page | Purpose |
|------|---------|
| Dashboard | Overview of all customers, device health, alerts firing |
| Customers | List of all customer accounts; create/edit/suspend |
| Devices | All gateways and sensors across all customers; assign to customers |
| Billing | Track invoice status per customer (Active / Overdue / Suspended) |
| Settings | Internal platform settings |

**Key rules:**
- Admin creates a customer account → customer can then log in to app.sensoqa.com
- Admin assigns a gateway and sensors to a customer
- Changes made on the admin side reflect immediately on the customer side
- Admin does NOT interact with app.sensoqa.com directly

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, driven by the Senso design system |
| Components | Design-system primitives in `apps/*/components/ui`, shell in `packages/ui` |
| Email | Resend |
| Package manager | npm (workspaces) |

**Workspaces:** `apps/{customer,admin}` and `packages/{tokens,ui,types,status,mock-data}`.
`packages/tokens` is the design system's CSS vendored verbatim; `packages/ui` is the app
shell shared by both sites.

**Rules:**
- Reach for an existing primitive in `components/ui` before building a new one; the
  design system is the source of truth for colour, type, radius and elevation
- No inline styles — Tailwind utilities backed by design-system tokens
- App Router only — no Pages Router patterns
- Keep components in `/components`, pages in `/app`
- Do not add new dependencies without asking first

---

## Data Model (Simplified)

```
Customer
  └── Gateway (one per site)          · mac_address = LoRaWAN Gateway EUI
        │                               decommissioned_at (soft delete)
        └── Sensor[]                  · hardware_id = LoRaWAN DevEUI
              │                         decommissioned_at (soft delete)
              │                         last_reading_at, last_reading_id,
              │                         last_temperature  ← trigger on readings
              └── Reading[]           · temperature  ← object.TempC_DS (external probe)
                                        humidity, battery_v
                                        rssi, snr, spreading_factor
                                        recorded_at

Sensor lifecycle                      commissioned_at  → in the record from here
                                      decommissioned_at → retired, history kept

AlertConfig (per Sensor)              AlertLog
  ├── type: min | max                     ├── kind: threshold | sensor_offline
  ├── threshold                           │         | gateway_offline
  ├── email_recipients[]                  ├── → AlertConfig  (RESTRICT)
  │                                       ├── → Reading      (RESTRICT)
  └── AlertThresholdHistory[]             ├── → Sensor / Gateway (offline kinds)
        ├── threshold                     ├── is_resolved
        ├── effective_from                └── notify_count
        └── effective_to  (null = open)      last_notified_at, notifying_at

Platform (no customer)
  PlatformStatus (one row)            · vps_last_seen_at, chirpstack_ok
                                        last_uplink_at
                                        sweep_last_ok_at, sender_last_ok_at
                                        last_customer_email_at
                                        ops_level, ops_level_since  ← watchdog memory
  JobRun[]        (append-only)       · job: sweep | sender | watchdog
                                        started_at, finished_at, ok, detail
  AlertNotification[] (append-only)   · customer, alert_ids[], recipients[]
                                        status: sent | failed, provider_id, error
```

- **`alert_threshold_history` is the compliance record of the limits themselves.** A
  reading is judged against the threshold in force when it was *recorded*, not today's
  value, so editing a limit can neither invent past violations nor erase real ones.
  Maintained by a trigger on `alert_configs`, because thresholds are written from the
  customer API, the admin API and the SQL console and only the database sees all three.
- **One `alert_logs` row per incident**, enforced by partial unique indexes on the open
  ones. `notify_count` tracks the immediate / +30 min / +2 h reminder schedule;
  `notifying_at` is a send lease, not a flag.

- `readings.temperature` is **`TempC_DS`**, the external probe — *not* `TempC_SHT`, which
  is the unit's internal sensor reading room temperature outside the fridge.
- A **`sites`/`branches`** layer (`customers → sites → gateways`) is anticipated for
  multi-branch customers, mirroring ChirpStack's tenant/application split. Not built yet.

---

## Design Language

- Clean, professional, utilitarian — not flashy
- Primary audience: restaurant managers, pharmacy staff, operations teams
- Must feel trustworthy and easy to scan at a glance
- Sensor status (online/offline) and temperature out-of-range should be visually obvious
- Reports must be print-friendly

The **Senso design system** now supplies the specifics: tokens in `packages/tokens`,
bridged into Tailwind by each app's `globals.css`. Status is a five-tone vocabulary —
`ok`, `warn`, `alert`, `cold`, `offline` — and tone is never decorative. Purple means
action or brand, never content or status. Print styling for reports stays ours; the
design system does not cover print geometry.

---

## Current State

- Product architecture and page structures are finalized; tech stack is locked in.
- **The platform is live on Supabase** — auth, customer scoping (RLS), and real data. The mock-data phase is over; new work wires to real APIs (still ask before inventing endpoints).
- **Backend / ingest exists** (in `apps/admin`): `POST /api/ingest` (one ChirpStack uplink per call, authenticated by the `CHIRPSTACK_INGEST_SECRET` bearer token, idempotent upsert). Ingest also stamps the relaying gateway's `last_seen_at`, identified by its 16-hex LoRa concentrator EUI. Duplicate-safe via a `UNIQUE(sensor_id, recorded_at)` index.
- **The LoRaWAN migration is complete** (`MIGRATION.md`, all phases). ChirpStack is
  self-hosted and live, the SenseCAP M2 gateway is online, the first Dragino LHT65N-E3
  joined and decodes correctly on EU868, and `/api/ingest` takes the ChirpStack payload.
  Real readings have been flowing since **2026-08-28 19:24**.
- **Live on production domains:** `app.sensoqa.com` (customer) and `admin.sensoqa.com`
  (admin) on Vercel, DNS at Cloudflare, with Supabase's Site URL and redirect allowlist
  pointed at them.
- **Email alerting is live** — Resend, sending from `sensoqa.com`. Threshold breaches and
  sensor silence both raise alerts; each is emailed immediately, again after 30 minutes,
  again after 2 hours, then goes quiet until it resolves. No all-clear email, no quiet
  hours. **Customers are not emailed about gateways** — `gateways.last_seen_at` is derived
  from readings, so it says nothing a silent sensor does not, and a dark site is ours to
  fix: it shows on the admin dashboard instead.
- **The alert scheduler runs from the ChirpStack VPS**, not Vercel Cron, which on the
  Hobby plan will not run more often than daily. `network-server/README.md` has the
  crontab. This makes the VPS load-bearing for alerting as well as ingest: if it goes
  down, breaches are still recorded but not sent — and the platform says so, to us
  only (see the watchdog below). Only *sending* depends on the VPS: threshold
  breaches are judged by the `readings` trigger and silent sensors by
  `sweep_offline_sensors()` on pg_cron, both inside Postgres. Moving the send
  schedule into the database too is deferred; `ALERTING.md` is the design and the
  phase tracker.
- **The old Pi/ESP32 pipeline is gone.** Any Pi still running the old forwarder or
  heartbeat timer gets a 401 from ingest and a 404 from the deleted heartbeat route;
  it can no longer touch the record or mark a gateway online.
- **Timestamps are timezone-aware** per customer (`customers.timezone`, default `Asia/Qatar`).
- **Devices are retired, never deleted.** `decommissioned_at` on `sensors`/`gateways` hides
  them from every live view while their records survive; the database enforces this with
  `RESTRICT` on all history foreign keys. See "Data integrity" below.
- **Both apps are on the Senso design system** — tokens vendored in `packages/tokens`, the
  app shell shared in `packages/ui`. Zero hardcoded palette classes remain in either app
  (`text-red-600`, `bg-green-500` and the rest are gone); status is the five-tone
  vocabulary throughout. The admin app's inner pages are themed through the token bridge
  but still use hand-rolled markup rather than the ported primitives.
- **Sensor names are customer-editable, so reports also carry the device ID** — the
  DevEUI, fixed at manufacture — and a rename can no longer break traceability.
- **A sensor joins the compliance record only when it is commissioned.**
  `sensors.commissioned_at` is stamped by a technician at install (`ONBOARDING.md`
  §6). Before it, readings are stored but raise no alerts and appear in no report,
  so a bench test at office temperature can never land in a customer's record as a
  fridge failure. Admin-only and one-way — the lifecycle is **register →
  commission → retire**, where retiring is the existing Unlink and keeps the
  sensor's history in reports. Logged to `sensor_commissioning_events`.
  **Gateways do not have this yet.**
- **The platform watches itself, and tells only us.** `platform_status` is one row of
  last-seen stamps: the VPS pulses it every minute (and reports whether ChirpStack
  answers), ingest stamps it on every uplink, and the alert job stamps each successful
  sweep and send. The **VPS watchdog** card at the top of the admin dashboard reads it;
  a `pg_cron` job inside Supabase reads it every five minutes and emails
  `OPS_ALERT_EMAIL` once when the level changes — down, late, or recovered. Customers
  are never in that path: an outage on our side is ours to explain, by hand. The
  older daily Vercel check on `job_heartbeats` remains as the last layer for when
  Supabase itself is down.
- **A dark site is still the customer's to hear about.** One restaurant's gateway
  losing power stales every sensor there at once and the customer gets one email
  listing them all. Kept deliberately (2026-09-10): all sensors down together is
  itself the signal, and only they can plug it back in.
- **Every run and every email attempt is a row.** `job_runs` (per job, per run,
  including skips and their reason) and `alert_notifications` (per customer email,
  with recipients and the provider's answer) are append-only. The morning after a
  strange night, the evidence is there.
- **`sensors.last_reading_at` is the source of truth for freshness, and the trigger
  that stamps it also judges the reading.** In the same transaction as the insert it
  stamps the sensor (never backwards), then — only for the sensor's newest reading,
  only when commissioned, only against active limits — opens or resolves the
  threshold alert. The offline sweep reads that stamp and nothing else. Both replaced
  the readings scan that raised false alerts on 2026-09-09. Pages still scan readings
  for display; that is cosmetic and deferred.
- **Ingest is a writer.** Auth, validation, a six-hour lower bound on the device
  timestamp, ChirpStack dedup, insert. It decides nothing.
- **Fixture tests exist.** `supabase/tests/alerting-v2/` proves the trigger and the
  sweep against a real PostgreSQL 16. Re-run before touching either.
- **The admin site carries its own ADMIN lockup**, so the two sites cannot be
  mistaken for each other at a glance. The destructive actions all live on that
  one.
- **One live registration per physical device**, enforced by partial unique
  indexes scoped to non-retired rows — so a device can move between customers
  after being retired, but never be registered twice at once.
- Pre-launch tasks (security hardening, retention, RLS verification, etc.) live in
  `TODO.md`; the running build log is `DEVLOG.md`; `README.md` is the orientation
  for someone arriving cold.

### Data integrity — the rule that must not be broken

**History tables (`readings`, `alert_logs`) are never cascade-deleted. Structure and config
tables (`gateways`, `sensors`, `alert_configs`) may be.**

This is enforced in the database via `ON DELETE RESTRICT`, not just in application code,
because the product's entire value is the record it produces. Removal is a **soft delete**
(`decommissioned_at`); hard deletes of devices are gone. Reports deliberately still list
retired sensors — tagged "Retired" with the retirement date — so historical records stay
producible after equipment is replaced.

---

## Out of Scope (Do Not Build Yet)

- Payment processing or billing automation
- SMS or push notifications
- Multi-location support per customer account
- Mobile app
- Additional sensor types beyond temperature
- Customer self-signup (onboarding is always manual)
- Separate technician role/login

---

## Vocabulary

Use these terms consistently:

| Term | Meaning |
|------|---------|
| **Sensor** | The physical temperature probe (Dragino LHT65N-E3) |
| **Gateway** | The LoRaWAN hub at the customer site (SenseCAP M2) |
| **Reading** | A single timestamped temperature data point |
| **Monitoring Report** | The printable compliance-style log report |
| **Alert** | A notification triggered when temp goes out of range |
| **Threshold** | The min/max temperature values that trigger an alert |
