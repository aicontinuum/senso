# Senso Dev Log

Running record of what was built each session. Most recent first.

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
