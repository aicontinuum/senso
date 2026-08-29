# Senso — Project Bible

## What is Senso?

Senso is an IoT-based temperature monitoring SaaS platform targeting the Qatar market. It replaces manual pen-and-paper temperature logging for regulated industries like restaurants, pharmacies, flower shops, and laboratories.

Hardware logs temperatures automatically → cloud stores and processes readings → customers view live data, receive alerts, and generate printable Monitoring Reports via a web dashboard.

---

## Business Model

- **Pricing currency:** QAR (Qatari Riyal)
- **Billing:** Manual invoicing only — no payment gateway integrated. Admin portal tracks billing status only.
- **Billing statuses:** Active / Overdue / Suspended
- **Onboarding:** White-glove only. A Senso technician physically visits the customer site, installs the gateway and sensors, logs into senso.com using the customer's credentials (no separate technician role), links the gateway, names sensors, sets alert thresholds and email recipients, then hands credentials to the customer.
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
senso.com (customer dashboard)
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

**Prototype stack (retired from the product path):** ESP32 + DS18B20 over raw LoRa into a
Raspberry Pi running the `gateway/` kit. Kept as a **test bench only** — it must not point
at the production ingest endpoint.

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
- Admin creates a customer account → customer can then log in to senso.com
- Admin assigns a gateway and sensors to a customer
- Changes made on the admin side reflect immediately on the customer side
- Admin does NOT interact with senso.com directly

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Package manager | npm |

**Rules:**
- Use shadcn/ui components wherever possible before building custom ones
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
              └── Reading[]           · temperature  ← object.TempC_DS (external probe)
                                        humidity, battery_v
                                        rssi, snr, spreading_factor
                                        recorded_at

AlertConfig (per Sensor)              AlertLog
  ├── min_temp                          ├── → AlertConfig  (RESTRICT)
  ├── max_temp                          └── → Reading      (RESTRICT)
  └── email_recipients[]
```

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

---

## Current State

- Product architecture and page structures are finalized; tech stack is locked in.
- **The platform is live on Supabase** — auth, customer scoping (RLS), and real data. The mock-data phase is over; new work wires to real APIs (still ask before inventing endpoints).
- **Backend / ingest exists** (in `apps/admin`): `POST /api/ingest` (readings, per-gateway secret auth, idempotent upsert), `POST /api/heartbeat` (60s liveness pulse), gateway identified by its 16-hex LoRa concentrator EUI. Duplicate-safe via a `UNIQUE(sensor_id, recorded_at)` index.
- **Mid-migration to LoRaWAN** (`MIGRATION.md`). Phases 0–3 and 5 are done: ChirpStack is
  self-hosted and live, the SenseCAP M2 gateway is online, the first Dragino LHT65N-E3 has
  joined and decodes correctly on EU868, and the Supabase schema is ready.
  **Phase 4 — rewriting `/api/ingest` for the ChirpStack payload — is the last step**, and
  until it lands no LoRaWAN readings reach the dashboard.
- **The old Pi/ESP32 pipeline is test-bench only** and must be disconnected from the
  production ingest endpoint (`systemctl disable --now senso-forwarder.service
  senso-heartbeat.timer`) — leaving the heartbeat running would show a dead gateway as
  Online forever.
- **Timestamps are timezone-aware** per customer (`customers.timezone`, default `Asia/Qatar`).
- **Devices are retired, never deleted.** `decommissioned_at` on `sensors`/`gateways` hides
  them from every live view while their records survive; the database enforces this with
  `RESTRICT` on all history foreign keys. See "Data integrity" below.
- Pre-launch tasks (security hardening, retention, RLS verification, etc.) live in
  `TODO.md`; the running build log is `DEVLOG.md`.

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
| **Sensor** | The physical temperature probe (ESP32 + DS18B20) |
| **Gateway** | The Raspberry Pi hub at the customer site |
| **Reading** | A single timestamped temperature data point |
| **Monitoring Report** | The printable compliance-style log report |
| **Alert** | A notification triggered when temp goes out of range |
| **Threshold** | The min/max temperature values that trigger an alert |
