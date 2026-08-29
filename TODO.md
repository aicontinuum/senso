# Pre-Launch TODO

## Security — audit 2026-07-04 (prioritized patch queue)

Full audit of the customer app, admin app + APIs, and gateway kit + repo hygiene. Ranked by severity. **Verify the RLS items against the live DB first — that is the single biggest risk.** (Shipped: per-gateway secret auth on `/api/ingest` + `/api/heartbeat` — but it's fail-open today; see Critical.)

### 🔴 Critical

- [x] ~~**Verify + fix RLS on every table (tenant isolation).**~~ **VERIFIED 2026-08-28 — the isolation risk is closed.** `pg_class.relrowsecurity` is `true` on all six public tables (`customers`, `gateways`, `sensors`, `readings`, `alert_configs`, `alert_logs`), and each has a SELECT policy resolving ownership back through `auth.uid()`. The earlier claim that `alert_logs` had a GRANT with no policy was wrong — `alert_logs_select_own` exists and is correctly scoped. No cross-customer read path remains. Residual items split out below (column scope on UPDATE, duplicate policies).

- [ ] **Device auth is fail-open.** `apps/admin/lib/gateway-auth.ts` returns authorized whenever `gateways.secret` is null/absent, so any gateway without a provisioned secret accepts unauthenticated writes — inject fake readings, send `offline:true` to flip sensors offline and silence alarms, or forge/suppress `alert_logs` — knowing only the public EUI. Flip to **fail-closed** (reject when no secret) and confirm every gateway row has a secret before go-live.

### 🟠 High

- [ ] **UPDATE policies are row-scoped but not column-scoped.** Confirmed 2026-08-28. `customers_update_own_record` lets a customer edit *any column of their own row* — including `billing_status`, `email`, `name` — i.e. self-service billing/identity tampering from devtools. `customers_update_own_sensors` is the same shape and now also exposes **`decommissioned_at`**: a customer can silently retire their own sensor, which stops ingest storing its readings and hides it from their dashboard, putting a hole in a compliance record with no audit trail. They can also rewrite `hardware_id`. Fix by restricting writable columns — column-level `GRANT UPDATE (col, ...)`, or route these edits through a `SECURITY DEFINER` function and drop the direct UPDATE policy. While there, change both policies from `TO public` to `TO authenticated`: not currently exploitable (for an anonymous request `auth.uid()` is NULL, so the qual never matches), but it misstates the intent. Verified safe otherwise — `with_check` is present on the `alert_configs` INSERT policy, and the `null` with_checks on the UPDATE policies are fine because PostgreSQL falls back to the USING expression for new rows.

- [ ] **Duplicate RLS policies.** `alert_configs` carries three SELECT policies (`customers_read_own_alert_configs`, `customers_select_own_alert_configs`, `alert_configs_select_own`) and `readings` carries two (`customers_select_own_readings`, `readings_select_own`). Permissive policies are OR'd so this is not currently a hole — but it is a trap: tightening one and missing its twins leaves the loosest one in force. Prune to one policy per table per command.

- [ ] **No rate limiting anywhere** — login, `/api/ingest`, `/api/heartbeat`, `/api/cron/alerts`, and all admin/customer APIs. Enables gateway enumeration, ingest flooding, and credential brute-force. Add per-IP + per-gateway throttling. `/api/cron/alerts` is bearer-token-only and world-reachable, so an attacker who guesses the token can burn the reminder schedule; throttling it is cheap because the legitimate caller runs once every five minutes.
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

- [x] ~~🔴 **Deleting a sensor destroys its entire temperature history (CASCADE).**~~ **FIXED 2026-08-27.** Migrations `20260827_sensor_soft_delete.sql` + `20260827_protect_alert_history.sql` applied and verified: `readings → sensors`, `alert_logs → alert_configs` and `alert_logs → readings` are all now `RESTRICT`; `sensors`/`gateways` carry `decommissioned_at` and both admin delete routes soft-delete; every live view filters retired devices while **reports** deliberately still list them (tagged "Retired", with the retirement date on screen/PDF/CSV) so historical records stay producible. Established invariant: **history tables (`readings`, `alert_logs`) never cascade-delete; structure/config tables (`gateways`, `sensors`, `alert_configs`) may.** Consequence for the future retention job — it must delete a period's `alert_logs` *before* its `readings`, or the RESTRICT will (deliberately) block it. Original finding below for context.

  Verified 2026-08-27: `readings_sensor_id_fkey` is `FOREIGN KEY (sensor_id) REFERENCES sensors(id) **ON DELETE CASCADE**`. Two live admin routes hard-delete sensors — `api/customers/[id]/sensors/[sensorId]/route.ts` (single sensor, "Unlink" button) and `api/customers/[id]/gateways/[gatewayId]/route.ts` which deletes **every sensor on the gateway** first. So one admin click on "unlink gateway" permanently erases all readings for all sensors under it. The UI confirm warns that sensors will be removed but says nothing about readings, and there is no undo. For a compliance product this is the worst possible data-loss path: an auditor asking "what was fridge 3 doing last March?" gets nothing, and the customer's retention obligation is silently broken. **Fix (both halves):** (1) change the FK to `ON DELETE RESTRICT` so the database physically refuses to destroy attributed history; (2) make sensor/gateway removal a **soft delete** — add `sensors.decommissioned_at timestamptz`, filter it out of customer + admin dashboards, and stop hard-deleting in those two routes. Also audit every other FK pointing at `sensors`/`gateways` for the same cascade (esp. `alert_configs` → `alert_logs`: losing alert history destroys the proof that someone *was* notified): `select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where confrelid in ('sensors'::regclass,'gateways'::regclass) and contype='f';`

- [ ] **Readings data retention policy** — the `readings` table grows indefinitely (every device tick adds a row, nothing is ever deleted). Deliberately **deferred** (2026-08-27): it's a pure backend job (`pg_cron` or a Vercel cron endpoint), shippable any time before or after go-live with no client, device or migration work — and the asymmetry favours waiting, since keeping data is cheap while deleting it early is irreversible.

  **Design when we do it:**
  - Key retention on **reading age**, not on whether the sensor was retired.
  - **≥ 2 years.** A shorter window (a 5-month idea was floated and rejected) risks falling under the legal minimum — food-safety regimes generally require temperature records for 1–2 years, and Qatar follows Codex/HACCP norms. Records auto-deleted below that would be a compliance failure *caused by us*, and the long-tail queries (inspection, illness investigation, insurance claim, supplier dispute) are exactly the ones that reach back months.
  - Consider **per-customer windows** — obligations differ by sector (pharmacy ≠ restaurant).
  - **Export/archive before delete**, so a customer is handed their records rather than losing them.
  - Delete **readings only**, keep the sensor row, so historical reports still name the device.
  - Storage is not the pressure: ~35k rows/sensor/year ≈ 2 MB, so 100 sensors × 2 years ≈ 350 MB.
  - Whatever window is chosen should be stated in the **customer terms** before go-live.

## Hardware / Ingest

- [x] ~~**Pi gateway watchdog / auto-restart**~~ — DONE. Forwarder runs as `senso-forwarder.service` with `Restart=always`; net-watchdog handles network drops; hardware watchdog (`watchdog.conf` + `dtparam=watchdog=on`) reboots a fully-frozen Pi. All in `gateway/`.

- [x] ~~**Duplicate readings from the gateway**~~ — DONE. Root cause was the LoRa concentrator reporting each uplink on multiple channels. Fixed with content-window dedup in `senso_forwarder.py` + a `UNIQUE(sensor_id, recorded_at)` index and upsert-ignore in `/api/ingest`. (The `accepted: 2` scare was a separate double-count bug in the ingest response, also fixed.)

- [ ] **Clean up pre-fix duplicate rows** — the `readings` table still holds the duplicate rows created before the dedup fixes. One-off `DELETE` keeping the earliest per (sensor_id, recorded_at)-ish group. Cosmetic; do before any historical reporting matters.

- [ ] **DS3231 RTC for the gateway** — the Pi Zero has no real-time clock, so timestamps during a long outage that includes a reboot can drift until NTP resyncs. A ~$3 DS3231 module gives minute-perfect offline timestamps. Optional hardware add.

## Gateway provisioning

- [ ] **Golden SD-card image** — build a master image so a new gateway is "flash card → plug in → running" instead of provisioning from scratch. Must handle the **per-gateway identity**: the LoRa concentrator EUI differs per device, so it can't be baked into a shared image. Plan: have the heartbeat auto-derive the gateway EUI from the concentrator's `lora_pkt_fwd` config (the forwarder already reads it from each packet) so `/etc/senso/gateway.env` needs no per-device editing — then the image is truly generic. Capture the image after `gateway/setup.sh` is run and verified on a reference Pi.

## Alerting & operations — added 2026-08-29

- [ ] **The VPS is now load-bearing for alerting, and nothing watches it.** The alert cron
  runs from the ChirpStack VPS crontab (`network-server/README.md`). If the VPS is down,
  or the crontab entry is removed, or `CRON_SECRET` drifts out of sync with Vercel,
  breaches are still recorded but **no one is told, and nothing anywhere says so**. This is
  the quietest failure mode in the product. Needs an external check that alerts *us* —
  either an uptime monitor on a health endpoint that reports when the sender last ran, or
  a dead-man's-switch ping from the cron line itself. Same monitor should cover ChirpStack.

- [ ] **An alert with no recipients is silently swallowed.** If a sensor's
  `email_recipients` is empty the send is skipped and the alert is marked notified, so it
  burns its schedule with nobody emailed. Deliberately left as-is for now (deliberate
  decision, 2026-08-29 — no configured address means no one to tell), but it should at
  least log, and ideally show on the admin dashboard, so an unconfigured customer is
  visible rather than quietly unmonitored.

- [ ] **Sensor-offline detection takes ~35 minutes**, inherited from the ingest cadence
  rather than chosen. Fine for a fridge, slow for a freezer. Revisit alongside reading
  gateway state from ChirpStack's own gateway API instead of inferring it.

- [ ] **No `.env` documentation drift check.** `.env.example` now exists for both apps
  (added 2026-08-29). Keep them updated when a variable is added — a missing one is
  invisible until something fails in production, which is how the Resend key was missed.

## Code health — added 2026-08-29

- [ ] **`deveui.ts` is duplicated byte-for-byte** between `apps/customer/lib/deveui.ts` and
  `apps/admin/lib/deveui-format.ts`. Now that `packages/` exists, move it to a shared
  package — this is exactly the drift that made the app shell worth extracting.

- [ ] **`apps/admin/vercel.json` is an empty `{}`** left behind when the cron block was
  removed. Harmless, but it reads as configuration that isn't there. Decide whether Vercel
  needs the file at all before deleting it.

- [ ] **The admin app's inner pages are themed but still hand-rolled markup** — customer
  detail, devices, billing. They pick up the design system's colours and type through the
  token bridge, but do not use the ported primitives. Follow-up to the design-system pass.

- [ ] **The threshold-history backfill used `-infinity`**, so readings predating the
  migration are still judged against today's threshold — the exact behaviour the feature
  removes. Accepted at the time because those were test runs. If any pre-migration reading
  ever needs to be defensible, this is the gap.
