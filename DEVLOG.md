# Senso Dev Log

Running record of what was built each session. Most recent first.

---

## 2026-07-04 — Live pipeline: timezones, offline detection, and a production-grade gateway

Big session. Took the platform from "mock/early-live" to a secure, self-healing, gap-free hardware-to-dashboard pipeline, and built a reusable gateway provisioning kit.

### Customer app (`apps/customer`)
- **Customer-selectable timezone.** New `lib/timezones.ts` (curated Gulf list, default `Asia/Qatar`). Settings gets a `TimezoneSection.tsx` dropdown that auto-saves via `/api/account` → stored on `customers.timezone`. Every timestamp now renders in the chosen zone — dashboard, sensor detail (incl. chart), alerts, gateway "last seen", and reports (with an explicit "All times shown in …" stamp on screen/PDF/CSV/email). `formatReadingTime` / new `formatDateTimeLong` in `lib/temperature.ts` take a timezone and are null-safe. Replaced the old inconsistent mix (UTC report headers vs browser-local rows).
- **Recent Readings chart** on the sensor detail page (recharts) — last 5 readings below the current reading, with dashed min/max threshold lines. (Fixed the initial bug where colors used `hsl(var(--primary))` but the app's tokens are oklch → invisible; now uses the CSS vars directly.)
- **Auto-refresh** — `components/auto-refresh.tsx` re-fetches every 5 min + on tab focus (dashboard + sensor detail) so live data stays current without a manual reload.
- **Freshness-based offline detection** — `lib/status.ts`: gateway Offline after **5 min** of silence (`GATEWAY_STALE_MS`), sensor after **50 min** (`SENSOR_STALE_MS`), derived from `last_seen_at` / latest-reading time rather than the `is_online`/`status` flags (a silently-dead device never updates those). Applied across dashboard, sensor detail, settings.
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
