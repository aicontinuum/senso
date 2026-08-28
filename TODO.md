# Pre-Launch TODO

## Security — audit 2026-07-04 (prioritized patch queue)

Full audit of the customer app, admin app + APIs, and gateway kit + repo hygiene. Ranked by severity. **Verify the RLS items against the live DB first — that is the single biggest risk.** (Shipped: per-gateway secret auth on `/api/ingest` + `/api/heartbeat` — but it's fail-open today; see Critical.)

### 🔴 Critical

- [ ] **Verify + fix RLS on every table (tenant isolation).** The customer app is a *thick client* — it runs authenticated Supabase queries **directly from the browser** with the anon key, so cross-customer isolation depends ENTIRELY on RLS being enabled with a correct policy on every table. The server-side `customer_id` filters in page code do NOT protect the direct `supabase.from(...)` path a malicious customer can call from devtools. Migration history shows gaps: `alert_logs` got a GRANT but no visible `CREATE POLICY`; `alert_configs` has SELECT/INSERT/UPDATE grants but no evidenced policy; `gateways`/`sensors`/`customers` have no documented policy. **Action — run in Supabase:** `select relname, relrowsecurity from pg_class where relname in ('customers','gateways','sensors','readings','alert_configs','alert_logs');` and `select tablename, policyname, cmd, qual, with_check from pg_policies;`. Every table needs RLS **enabled** + a policy scoping to the owning customer (reuse `customer_owns_sensor()`), with `WITH CHECK` on INSERT/UPDATE. Worst case today: any logged-in customer reads/edits every other tenant's alerts, thresholds, recipient emails, sensors, gateways, and customer records straight from the browser.

- [ ] **Device auth is fail-open.** `apps/admin/lib/gateway-auth.ts` returns authorized whenever `gateways.secret` is null/absent, so any gateway without a provisioned secret accepts unauthenticated writes — inject fake readings, send `offline:true` to flip sensors offline and silence alarms, or forge/suppress `alert_logs` — knowing only the public EUI. Flip to **fail-closed** (reject when no secret) and confirm every gateway row has a secret before go-live.

### 🟠 High

- [ ] **No rate limiting anywhere** — login, `/api/ingest`, `/api/heartbeat`, and all admin/customer APIs. Enables gateway enumeration, ingest flooding, and credential brute-force. Add per-IP + per-gateway throttling.
- [ ] **Unbounded `readings[]` in `/api/ingest`** — no length cap; each element runs several sequential service-role queries. One POST with 100k entries = DoS + unbounded inserts (no auth needed given fail-open). Cap array length and validate.
- [ ] **LAN packet injection into the forwarder** — `senso_forwarder.py` binds `0.0.0.0:1700` with no source check and trusts the raw payload (no LoRaWAN MIC). Anyone on the customer LAN can spoof `PUSH_DATA` for any `hardware_id`/temperature; the Pi then forwards it *authenticated* (it holds the secret) into the compliance record. Bind `127.0.0.1` (lora_pkt_fwd is local).
- [ ] **`/etc/senso/gateway.env` not `chmod 600` on all paths** — created `install -m 644` (world-readable); `chmod 600` only runs on the auto-generate branch, so a hand-set secret stays 644. Any local user reads the gateway secret. Always `chmod 600`.
- [ ] **Forwarder runs as root with a network-facing parser + zero systemd hardening** — a parser bug on the unauthenticated UDP surface = root RCE on-premises. Run as an unprivileged `senso` user; add `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `RestrictAddressFamilies=AF_INET AF_INET6`.
- [ ] **`customers` UPDATE policy too broad** — own-row only, but a customer can `update({billing_status, email, name})` directly from the browser (self-service billing/identity tampering). Restrict to `contact_name`/`phone`/`alert_recipients`/`timezone` via column grants or a SECURITY DEFINER function. (This is part of the RLS Critical item.)

### 🟡 Medium

- [ ] **Ingest input validation** — `temperature` (type/range) and `recorded_at` (bounded timestamp) unvalidated. Since `recorded_at` is the upsert conflict key, a future timestamp can silently drop a later real reading as a "duplicate." Reject non-numeric temps and out-of-window dates.
- [ ] **Gateway enumeration** — ingest/heartbeat return `404` for unknown gateway vs `401` for bad secret; spraying EUIs reveals real gateways. Return a uniform response for both.
- [ ] **Threshold validation on `/api/sensors/[id]`** — `NaN >= NaN` is false, so a non-numeric min/max passes and writes `null` thresholds (disables alerting); no bounds check. Validate numeric + sane range + min<max server-side.
- [ ] **Server-side email-recipient validation** — `/api/account` (`alertRecipients`) and `/api/sensors/[id]` (`emailRecipients`) accept arbitrary arrays, no per-item email regex or length cap (client checks don't count). These become email send-targets. Validate + cap.
- [ ] **Customer-create password/email not validated server-side** — `/api/customers` forwards `password` to `createUser` with no strength check (password-change enforces ≥8) and no server email regex. Add both.
- [ ] **Unbounded `queue.db` growth on the Pi** — no cap/eviction; a LAN flood or multi-week outage fills the SD card and wedges the gateway. Add a max-rows cap / retention.
- [ ] **Heartbeat secret on curl argv** — `heartbeat.sh` passes `-H "Authorization: Bearer $SECRET"`, visible in `ps`/`/proc` each minute. Use `-H @file` / `--config` / stdin. (Forwarder is fine — sends via `requests`.)
- [ ] **`net-watchdog` reboot loop is LAN-triggerable** — reboots after 15 min of failed pings to a single fixed host; blocking those pings forces perpetual reboots (also a false-positive on networks that block 1.1.1.1). Use multiple/local targets and make reboot more conservative.
- [ ] **CSV formula injection + broken quoting** — `reports/ReportClient.tsx` export doesn't double embedded `"` and has no neutralizing prefix for `= + - @`. Vector is admin-set names (lower likelihood), but escape quotes and prefix risky cells.
- [ ] **Root `.gitignore` misses a stray `gateway.env`** — patterns are exact names, not a `.env*` glob; a copied real `gateway.env` (with a live secret) could be committed. Add `*.env` / `.env*` at root and `gateway/`.

### 🟢 Low / hardening

- [ ] **Raw Supabase `error.message` returned to clients** (admin + customer routes) — leaks schema/constraint details. Return generic messages; log details server-side.
- [ ] **Unhandled `request.json()`** in `/api/ingest`, `/api/account`, `/api/sensors/[id]` → 500 on malformed body. Wrap → 400 (heartbeat already does).
- [ ] **Secret printed to stdout during `setup.sh`** (and briefly in `sed` argv) — leaks into provisioning/CI logs. Have the user read it from the env file instead.
- [ ] **No security headers** — add HSTS/CSP/X-Frame-Options via `next.config.ts` / `vercel.json`.
- [ ] **Docs disclose the security model** (open ingest, no rate limiting, RLS gaps, prod host) — fine while private; scrub/relocate if the repo ever goes public.
- [ ] **Delete dead `apps/customer/lib/supabase.ts`** — unused anon client not wired to SSR cookies; remove to prevent future misuse.
- [ ] **`contactName`/`phone` unbounded** on `/api/account` — add length caps.

## Database

- [ ] 🔴 **Deleting a sensor destroys its entire temperature history (CASCADE).** Verified 2026-08-27: `readings_sensor_id_fkey` is `FOREIGN KEY (sensor_id) REFERENCES sensors(id) **ON DELETE CASCADE**`. Two live admin routes hard-delete sensors — `api/customers/[id]/sensors/[sensorId]/route.ts` (single sensor, "Unlink" button) and `api/customers/[id]/gateways/[gatewayId]/route.ts` which deletes **every sensor on the gateway** first. So one admin click on "unlink gateway" permanently erases all readings for all sensors under it. The UI confirm warns that sensors will be removed but says nothing about readings, and there is no undo. For a compliance product this is the worst possible data-loss path: an auditor asking "what was fridge 3 doing last March?" gets nothing, and the customer's retention obligation is silently broken. **Fix (both halves):** (1) change the FK to `ON DELETE RESTRICT` so the database physically refuses to destroy attributed history; (2) make sensor/gateway removal a **soft delete** — add `sensors.decommissioned_at timestamptz`, filter it out of customer + admin dashboards, and stop hard-deleting in those two routes. Also audit every other FK pointing at `sensors`/`gateways` for the same cascade (esp. `alert_configs` → `alert_logs`: losing alert history destroys the proof that someone *was* notified): `select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where confrelid in ('sensors'::regclass,'gateways'::regclass) and contype='f';`

- [ ] **Readings data retention policy** — the `readings` table grows indefinitely (every simulator/device tick adds a row, nothing is ever deleted). Before go-live, define a retention window (e.g. keep 2 years, archive or delete older rows) and set up a scheduled job (Supabase cron or pg_cron) to enforce it.

## Hardware / Ingest

- [x] ~~**Pi gateway watchdog / auto-restart**~~ — DONE. Forwarder runs as `senso-forwarder.service` with `Restart=always`; net-watchdog handles network drops; hardware watchdog (`watchdog.conf` + `dtparam=watchdog=on`) reboots a fully-frozen Pi. All in `gateway/`.

- [x] ~~**Duplicate readings from the gateway**~~ — DONE. Root cause was the LoRa concentrator reporting each uplink on multiple channels. Fixed with content-window dedup in `senso_forwarder.py` + a `UNIQUE(sensor_id, recorded_at)` index and upsert-ignore in `/api/ingest`. (The `accepted: 2` scare was a separate double-count bug in the ingest response, also fixed.)

- [ ] **Clean up pre-fix duplicate rows** — the `readings` table still holds the duplicate rows created before the dedup fixes. One-off `DELETE` keeping the earliest per (sensor_id, recorded_at)-ish group. Cosmetic; do before any historical reporting matters.

- [ ] **DS3231 RTC for the gateway** — the Pi Zero has no real-time clock, so timestamps during a long outage that includes a reboot can drift until NTP resyncs. A ~$3 DS3231 module gives minute-perfect offline timestamps. Optional hardware add.

## Gateway provisioning

- [ ] **Golden SD-card image** — build a master image so a new gateway is "flash card → plug in → running" instead of provisioning from scratch. Must handle the **per-gateway identity**: the LoRa concentrator EUI differs per device, so it can't be baked into a shared image. Plan: have the heartbeat auto-derive the gateway EUI from the concentrator's `lora_pkt_fwd` config (the forwarder already reads it from each packet) so `/etc/senso/gateway.env` needs no per-device editing — then the image is truly generic. Capture the image after `gateway/setup.sh` is run and verified on a reference Pi.
