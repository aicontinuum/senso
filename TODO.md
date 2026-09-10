# Pre-Launch TODO

## Security — audit 2026-07-04 (prioritized patch queue)

Full audit of the customer app, admin app + APIs, and gateway kit + repo hygiene. Ranked by severity. **Verify the RLS items against the live DB first — that is the single biggest risk.** Re-audited 2026-09-08 after the Pi kit was removed: the device-auth items are closed, the Next.js advisories are patched, and seven findings that were not on this list were added, marked *added 2026-09-08*.

### 🔴 Critical

- [x] ~~**Verify + fix RLS on every table (tenant isolation).**~~ **VERIFIED 2026-08-28 — the isolation risk is closed.** `pg_class.relrowsecurity` is `true` on all six public tables (`customers`, `gateways`, `sensors`, `readings`, `alert_configs`, `alert_logs`), and each has a SELECT policy resolving ownership back through `auth.uid()`. The earlier claim that `alert_logs` had a GRANT with no policy was wrong — `alert_logs_select_own` exists and is correctly scoped. No cross-customer read path remains. Residual items split out below (column scope on UPDATE, duplicate policies).

- [x] ~~**Device auth is fail-open.**~~ **CLOSED 2026-09-08 — the Pi kit was removed.** `gateway-auth.ts`, `/api/heartbeat`, the `gateway/` directory and the `gateways.secret` column (`20260908_drop_gateway_secret.sql`) are gone; the only live write path is `/api/ingest`, which fails closed on `CHIRPSTACK_INGEST_SECRET`. Original finding: `apps/admin/lib/gateway-auth.ts` returns authorized whenever `gateways.secret` is null/absent, so any gateway without a provisioned secret accepts unauthenticated writes — inject fake readings, send `offline:true` to flip sensors offline and silence alarms, or forge/suppress `alert_logs` — knowing only the public EUI. Flip to **fail-closed** (reject when no secret) and confirm every gateway row has a secret before go-live.

### 🟠 High

- [x] ~~**Ingest accepts backdated readings**~~ **FIXED 2026-09-10 (Alerting v2 phase 4)** — `time` older than six hours is refused (`MAX_READING_AGE_MS`), `deduplicationId` is stored in `readings.dedup_id` under a unique index, and threshold evaluation moved into the `readings` trigger, which only judges a reading that is newer than the sensor's stamp — so a backdated in-range reading can no longer resolve an open breach. Proven by `supabase/tests/alerting-v2`. Original finding: `/api/ingest` only capped `time` against the future; `/api/ingest` only caps `time` against the future (`MAX_CLOCK_SKEW_MS`); there is no lower bound, `deduplicationId` is parsed into the type but never used, and a retry with a *different* `time` is a new row. Anyone holding the single shared `CHIRPSTACK_INGEST_SECRET` can therefore write or rewrite years of a customer's compliance history. Worse, threshold evaluation runs on the incoming reading regardless of age, so a backdated in-range reading resolves a currently open breach (`is_resolved = true`) and the customer is never told. Fix: reject `time` older than a bounded window (a few hours — enough for ChirpStack retries, not enough for history), dedupe on `deduplicationId`, and only evaluate alerts when the reading is newer than the sensor's latest stored `recorded_at`.

- [ ] **Base schema and RLS policies are not in the repo** *(added 2026-09-08)* — `supabase/migrations/` starts at 2026-08-27. The six original tables, every policy on them, and `customer_owns_sensor(uuid)` — the SECURITY DEFINER function every newer policy in the repo delegates tenant isolation to — exist only in the live Supabase project. Nothing about who can see what can be reviewed, diffed, or rebuilt from git, and a lost project is a lost security model. Fix: export `pg_policies`, the function body (check it pins `search_path`), and `information_schema.role_table_grants` for `public` into a dated baseline migration, then keep every policy change in a migration from then on.

- [ ] **UPDATE policies are row-scoped but not column-scoped.** Confirmed 2026-08-28. **Half closed 2026-09-02:** `sensors` is now column-scoped — `20260902_sensor_commissioning.sql` revokes table-wide UPDATE from `anon`/`authenticated` and grants only `UPDATE (name)`, which was a prerequisite for `commissioned_at` (without it a customer could set it forward and erase their own record). Verified against a real PostgreSQL 16: the rename still succeeds, while writes to `commissioned_at`, `decommissioned_at` and `hardware_id` are refused. **`customers` is still wide open** — the billing/identity half below is unchanged. `customers_update_own_record` lets a customer edit *any column of their own row* — including `billing_status`, `email`, `name` — i.e. self-service billing/identity tampering from devtools. `customers_update_own_sensors` is the same shape and now also exposes **`decommissioned_at`**: a customer can silently retire their own sensor, which stops ingest storing its readings and hides it from their dashboard, putting a hole in a compliance record with no audit trail. They can also rewrite `hardware_id`. Fix by restricting writable columns — column-level `GRANT UPDATE (col, ...)`, or route these edits through a `SECURITY DEFINER` function and drop the direct UPDATE policy. While there, change both policies from `TO public` to `TO authenticated`: not currently exploitable (for an anonymous request `auth.uid()` is NULL, so the qual never matches), but it misstates the intent. Verified safe otherwise — `with_check` is present on the `alert_configs` INSERT policy, and the `null` with_checks on the UPDATE policies are fine because PostgreSQL falls back to the USING expression for new rows.

- [ ] **Duplicate RLS policies.** `alert_configs` carries three SELECT policies (`customers_read_own_alert_configs`, `customers_select_own_alert_configs`, `alert_configs_select_own`) and `readings` carries two (`customers_select_own_readings`, `readings_select_own`). Permissive policies are OR'd so this is not currently a hole — but it is a trap: tightening one and missing its twins leaves the loosest one in force. Prune to one policy per table per command.

- [ ] **No rate limiting anywhere** — login, `/api/ingest`, `/api/cron/*`, and all admin/customer APIs. Enables ingest flooding and credential brute-force. Add per-IP throttling. `/api/cron/alerts` is bearer-token-only and world-reachable, so an attacker who guesses the token can burn the reminder schedule; throttling it is cheap because the legitimate caller runs once every five minutes.
- [x] ~~**Unbounded `readings[]` in `/api/ingest`**~~ **MOOT 2026-09-08** — ingest now takes one ChirpStack uplink per POST; there is no array. Original finding: no length cap; each element runs several sequential service-role queries. One POST with 100k entries = DoS + unbounded inserts (no auth needed given fail-open). Cap array length and validate.
- [x] ~~**LAN packet injection into the forwarder**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: `senso_forwarder.py` binds `0.0.0.0:1700` with no source check and trusts the raw payload (no LoRaWAN MIC). Anyone on the customer LAN can spoof `PUSH_DATA` for any `hardware_id`/temperature; the Pi then forwards it *authenticated* (it holds the secret) into the compliance record. Bind `127.0.0.1` (lora_pkt_fwd is local).
- [x] ~~**`/etc/senso/gateway.env` not `chmod 600` on all paths**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: created `install -m 644` (world-readable); `chmod 600` only runs on the auto-generate branch, so a hand-set secret stays 644. Any local user reads the gateway secret. Always `chmod 600`.
- [x] ~~**Forwarder runs as root with a network-facing parser + zero systemd hardening**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: a parser bug on the unauthenticated UDP surface = root RCE on-premises. Run as an unprivileged `senso` user; add `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `RestrictAddressFamilies=AF_INET AF_INET6`.
- [ ] **`customers` UPDATE policy too broad** — own-row only, but a customer can `update({billing_status, email, name})` directly from the browser (self-service billing/identity tampering). Restrict to `contact_name`/`phone`/`alert_recipients`/`timezone` via column grants or a SECURITY DEFINER function. (This is part of the RLS Critical item.)

### 🟡 Medium

- [ ] **No CSRF protection on any mutating route** *(added 2026-09-08)* — every admin and customer API route relies solely on the Supabase session cookie; there is no Origin/Referer check and no token. Practical exposure is low today because the routes are JSON `PATCH`/`PUT`/`POST` (an HTML form cannot send them cross-site) behind a `SameSite=Lax` cookie, but CLAUDE.md §5 requires it and the next plain-form route would be exposed. Fix: reject mutating requests whose `Origin` is not the app's own origin, in one shared helper called first in every route.

- [ ] **A bad admin-entered alert recipient aborts alert delivery for a whole batch** *(added 2026-09-08)* — `PATCH /api/customers/[id]` writes `alertRecipients` to `customers.alert_recipients` after only an `Array.isArray` check: elements are not validated as strings or as email addresses. `cron/alerts` then calls `.toLowerCase()` on each element while loading context, so one non-string entry throws inside the run and every alert claimed in that batch stays unsent (and, until the lease expires, unclaimable). Fix: validate with the same rules the customer app already uses (`apps/customer/lib/recipients.ts`) and move that helper somewhere both apps share.

- [ ] **Customer password change re-verifies the current password client-side only** *(added 2026-09-08)* — `ChangePasswordSection.tsx` calls `signInWithPassword` and then `updateUser({ password })`, but `updateUser` itself does not require the old password, so anyone holding a live session (stolen cookie, unattended device) can call it directly from devtools and skip the check. Whether GoTrue enforces re-authentication is the Supabase project's "Secure password change" setting, not code. Fix: confirm that setting is on in the dashboard, set the server-side minimum password length there too (the client's 8 is cosmetic), and record both in `SENSO.md` so they survive a project rebuild.

- [x] ~~**Ingest input validation**~~ **FIXED** — temperature is coerced and bounded (−80..100 °C) and `recorded_at` is bounded on both sides as of phase 4. Original finding: `temperature` (type/range) and `recorded_at` (bounded timestamp) unvalidated. Since `recorded_at` is the upsert conflict key, a future timestamp can silently drop a later real reading as a "duplicate." Reject non-numeric temps and out-of-window dates.
- [x] ~~**Gateway enumeration**~~ **CLOSED 2026-09-08** — `/api/heartbeat` is deleted, and `/api/ingest` already answers an unknown device with the same `200` it gives any other ignored uplink, after the shared secret has been checked. Original finding: ingest/heartbeat return `404` for unknown gateway vs `401` for bad secret; spraying EUIs reveals real gateways.
- [ ] **Threshold validation on `/api/sensors/[id]`** — `NaN >= NaN` is false, so a non-numeric min/max passes and writes `null` thresholds (disables alerting); no bounds check. Validate numeric + sane range + min<max server-side.
- [ ] **Server-side email-recipient validation** — `/api/account` (`alertRecipients`) and `/api/sensors/[id]` (`emailRecipients`) accept arbitrary arrays, no per-item email regex or length cap (client checks don't count). These become email send-targets. Validate + cap.
- [ ] **Customer-create password/email not validated server-side** — `/api/customers` forwards `password` to `createUser` with no strength check (password-change enforces ≥8) and no server email regex. Add both.
- [x] ~~**Unbounded `queue.db` growth on the Pi**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: no cap/eviction; a LAN flood or multi-week outage fills the SD card and wedges the gateway. Add a max-rows cap / retention.
- [x] ~~**Heartbeat secret on curl argv**~~ **REMOVED 2026-09-08 with the Pi kit.** The same pattern still exists on the VPS: the alert crontab in `network-server/README.md` passes `CRON_SECRET` on the curl command line. Original finding: `heartbeat.sh` passes `-H "Authorization: Bearer $SECRET"`, visible in `ps`/`/proc` each minute. Use `-H @file` / `--config` / stdin. (Forwarder is fine — sends via `requests`.)
- [x] ~~**`net-watchdog` reboot loop is LAN-triggerable**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: reboots after 15 min of failed pings to a single fixed host; blocking those pings forces perpetual reboots (also a false-positive on networks that block 1.1.1.1). Use multiple/local targets and make reboot more conservative.
- [ ] **CSV formula injection + broken quoting** — `reports/ReportClient.tsx` export doesn't double embedded `"` and has no neutralizing prefix for `= + - @`. Vector is admin-set names (lower likelihood), but escape quotes and prefix risky cells.
- [x] ~~**Root `.gitignore` misses a stray `gateway.env`**~~ **FIXED 2026-09-08** — root `.gitignore` now ignores `.env`, `.env.*` and `*.env` everywhere, with `.env.example` opted back in. Original finding: patterns are exact names, not a `.env*` glob; a copied real `gateway.env` (with a live secret) could be committed. Add `*.env` / `.env*` at root and `gateway/`.

### 🟢 Low / hardening

- [ ] **A crafted login link logs a customer out** *(added 2026-09-08)* — visiting `/login?error=session` (or `?error=not_customer`) while signed in makes `LoginForm` call `signOut()`, and the middleware deliberately does not bounce a `/login` URL carrying `error`, so any link an attacker can get a user to click ends their session. Nuisance, not a breach. Fix: only sign out on the error values the app itself sets *and* only when the page was reached by a redirect from the app (a one-shot flag), or clear the session server-side at the redirect and drop the client-side `signOut` entirely.

- [ ] **Alert comments are impossible on offline alerts** *(added 2026-09-08)* — the three `alert_comments` policies in `20260902_alert_comments.sql` resolve ownership via `alert_logs → alert_configs`, but `sensor_offline` alerts have `alert_config_id = NULL` (`20260829_alert_notifications.sql`), so the inner join fails and the insert is refused with zero rows → the UI's "Could not save the comment" on every offline alert. Fails closed, so no leak, but the alert detail page still renders the comment box for them. Fix: route ownership through `alert_logs.sensor_id` (populated for offline alerts) as well as `alert_config_id`, in a migration, and verify against the live DB.

- [ ] **Raw Supabase `error.message` returned to clients** (admin + customer routes) — leaks schema/constraint details. Return generic messages; log details server-side.
- [ ] **Unhandled `request.json()`** in `/api/ingest`, `/api/account`, `/api/sensors/[id]` → 500 on malformed body. Wrap → 400 (heartbeat already does).
- [x] ~~**Secret printed to stdout during `setup.sh`**~~ **REMOVED 2026-09-08 with the Pi kit.** Original finding: (and briefly in `sed` argv) leaks into provisioning/CI logs. Have the user read it from the env file instead.
- [ ] **No security headers** — add HSTS/CSP/X-Frame-Options via `next.config.ts` / `vercel.json`.
- [ ] **Docs disclose the security model** (no rate limiting, RLS gaps, and `network-server/README.md` carries the VPS public IP, hostname and SSH details) — fine while private; scrub/relocate if the repo ever goes public.
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

- [ ] **The VPS is now load-bearing for alerting, and nothing watches it.** **Layer 1 BUILT 2026-09-08** — `job_heartbeats` plus `/api/cron/health` on a daily Vercel cron; the alert sender stamps a row on each completed run and the check emails `OPS_ALERT_EMAIL` when that stamp goes stale for 30 minutes. **Layer 2 still open:** the external dead-man's-switch, which is what brings detection down from up-to-24-hours to minutes.
  **Design settled 2026-09-07, deferred by choice — build it before the second
  customer.** Two layers, not exclusive:

  1. *Daily backstop, mostly code.* The alerts route stamps a `last_run_at` on
     each run; a once-daily Vercel cron reads it and emails if the gap exceeds
     ~30 minutes. Needs one small table and one env var for the destination
     address (`OPS_ALERT_EMAIL`) — both settable from a phone. Vercel's Hobby
     plan caps cron at once per day, which is why detection is up to 24h behind;
     that is still infinitely better than never.
  2. *External monitor, ~15 minutes at a computer.* A free dead-man's-switch
     (Healthchecks.io, UptimeRobot) that the crontab line pings on success and
     which emails when the pings stop. Detects within minutes.

  Build both: the monitor does the real work, the daily check keeps working if
  the monitor lapses.
 The alert cron
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

## Pre-deployment — added 2026-09-06

- [x] ~~**No unique constraint on a device's identifier.**~~ **FIXED 2026-09-07** — `20260907_one_live_row_per_device.sql` adds partial unique indexes on `sensors.hardware_id` and `gateways.mac_address` scoped to live rows, and drops any plain unique constraint on those columns first (a plain one counts retired rows and would refuse the legitimate re-registration). Both admin create routes now say what to do about it. Verified against a real PostgreSQL 16 in both starting states. Original finding below. `sensors.hardware_id` and
  `gateways.mac_address` can each hold two live rows for the same physical device.
  Ingest looks a sensor up by DevEUI filtered to `decommissioned_at is null` with
  `maybeSingle()`, so two live rows make that call error — and the code reads the
  error as "unknown device", **silently drops the readings**, and logs
  `unregistered or retired DevEUI`. Completely misleading, and the exact shape of
  moving a device between customer accounts if the old row is not retired first.
  Fix with partial unique indexes:

  ```sql
  create unique index if not exists sensors_hardware_id_active
    on sensors (hardware_id) where decommissioned_at is null;
  create unique index if not exists gateways_mac_address_active
    on gateways (mac_address) where decommissioned_at is null;
  ```

  Deferred 2026-09-06 by choice. Until then the discipline is: **retire the old
  row before registering the device under a new account.**

- [x] ~~**`/api/heartbeat` is dead weight and fail-open.**~~ **DONE 2026-09-08** — route, `lib/gateway-auth.ts`, the `gateway/` kit and `scripts/simulate.mjs` deleted; `gateways.secret` dropped by `20260908_drop_gateway_secret.sql` (apply it). Original finding: It is the old Pi kit's
  liveness pulse; the LoRaWAN chain never calls it, and `/api/ingest` stamps
  `gateways.last_seen_at` itself. It authenticates with `gatewaySecretOk`, which
  allows the request when the gateway row has no secret — so anyone knowing a
  gateway EUI can stamp it "alive" and hide a dark site from the admin dashboard.
  It cannot inject readings or silence a customer alert. Delete the route and
  `lib/gateway-auth.ts` rather than fixing them; that closes the "device auth is
  fail-open" Critical item above, which no longer applies to the live path.

## Alerting bugs — added 2026-09-02 (both affect `sensor_offline`)

- [x] ~~**Who receives an offline alert depends on what else fired.**~~ **FIXED 2026-09-02** by collapsing the two recipient lists into one (`customers.alert_recipients`). With a single list resolved per customer, batch composition cannot change who is emailed, and there is no longer any way to have addresses on sensors but none on the account. Original finding below. Recipients
  are built per customer from `customers.alert_recipients`, then per-sensor
  recipients are merged in **only for alerts that carry an `alert_config_id`**.
  Offline alerts do not carry one, so an offline alert alone in a run reaches
  only the account-level list — but batched with a threshold alert for the same
  customer it also reaches that sensor's list. Same alert, different recipients.
  Worse: a customer with per-sensor recipients and an empty account-level list
  may be emailed by **nobody**, and `sendDueAlerts` counts that as sent, so the
  schedule is consumed silently. Fix by resolving recipients per customer up
  front from the account list plus every sensor they own, independent of batch
  composition. In `apps/admin/app/api/cron/alerts/route.ts`, `loadContext()`.

- [x] ~~**The reminder schedule compresses on offline alerts.**~~ **ACCEPTED 2026-09-02 — not a bug worth fixing.** Nothing is missed or duplicated in substance; the second email simply lands about five minutes after the first instead of thirty. Left as-is deliberately. Original finding below, so nobody re-raises it: `triggered_at` is
  back-dated — to when contact was lost — which is right for display and wrong
  as the schedule anchor. `claim_due_alerts` reminds when
  `notify_count = 1 and triggered_at < now() - interval '30 minutes'`, and an
  offline alert is already 35 minutes old when created, so the first reminder is
  due on the very next run: a second email about five minutes after the first
  rather than thirty. Fix by anchoring reminders on `last_notified_at` instead,
  which also makes the rule read as what it means. Needs a small migration to
  `claim_due_alerts`.

## Alerting — added 2026-09-09

- [x] ~~**Should a dark site email the customer, or only us?**~~ **DECIDED 2026-09-10 — unchanged, customer is told.** When one restaurant's gateway loses power or internet, every sensor there goes stale together and the customer receives one email listing all of them. Kept deliberately: all sensors down at once is itself the signal that the fault is bigger than a sensor, and the customer is the only one who can plug the gateway back in. Not to be confused with the VPS rule, which is the opposite: a failure on our side reaches `OPS_ALERT_EMAIL` only, never a customer (Alerting v2 phase 2b). Do not re-raise without a customer asking for it.

- [x] ~~**A retired sensor's open *threshold* alert also strands.**~~ **FIXED 2026-09-10** — `sweep_offline_sensors()` closes any open threshold alert whose sensor is retired or uncommissioned, through the `alert_configs` join; `resolved_at` is stamped. Fixture case "retired sensor stranded threshold alert closed". Original finding: The sweep now
  closes stranded `sensor_offline` alerts, but threshold alerts are resolved by
  `/api/ingest` when a reading comes back in range — and a retired sensor gets no
  readings, because ingest filters on `decommissioned_at is null`. So a breach
  that was open at the moment of retirement stays Active on the customer's alerts
  page forever, against a device that no longer exists.

  Not folded into the offline fix because it needs a different join: threshold
  alerts carry `alert_config_id`, not `sensor_id`, so reaching the sensor means
  going through `alert_configs`. Worth a moment's thought too on whether
  auto-resolving reads as "the fridge recovered" — `is_resolved` means the
  incident is closed, which for a retired sensor it genuinely is, but the wording
  on the alerts page should be checked before flipping them.

## Commissioning — added 2026-09-02

- [x] ~~**Gateways have the commissioning gap that sensors no longer do.**~~
  **NOT AN ISSUE 2026-09-02 — closed deliberately, do not re-raise.** The half
  that mattered went away when customers stopped being emailed about gateways: a
  bench gateway can no longer send anyone a "Gateway1 is offline" message about a
  box they have not received. What remains is a bench gateway counting towards
  the admin dashboard's "Sites dark" tile until it is installed — a wrong number
  on our own screen, which we can read past. Register a gateway near the time it
  is installed and even that goes away.

- [ ] **Nothing chases a sensor left uncommissioned.** The admin dashboard counts
  them under "awaiting commissioning", which is passive. A sensor stuck there is
  a customer paying for monitoring they are not getting — worth an alert to us,
  not just a number on a page someone has to visit.

- [ ] **`sensor_commissioning_events` has no UI.** The audit trail is written and
  is queryable in SQL, but nothing displays it. Fine while the fleet is small;
  the point of an audit trail is that someone can read it without a database
  client.

- [ ] **No office-side procedure for a mis-commission.** Commissioning is one-way
  in the UI by design, so a sensor commissioned by mistake is corrected with SQL:
  clear `sensors.commissioned_at`, and write the matching `uncommissioned` row to
  `sensor_commissioning_events` with a reason so the correction is on record.
  Two things that need doing by hand and would be easy to forget: **resolve any
  open `alert_logs` for that sensor** (ingest's early return for an
  out-of-service sensor sits above the branch that resolves them, so one left
  open stays open), and **note the previous `commissioned_at`** before clearing
  it, since nothing else records it. Worth writing up as a runbook entry, or
  wrapping in a `SECURITY DEFINER` function that does all three correctly.

## Code health — added 2026-08-29

- [ ] **`deveui.ts` is duplicated byte-for-byte** between `apps/customer/lib/deveui.ts` and
  `apps/admin/lib/deveui-format.ts`. Now that `packages/` exists, move it to a shared
  package — this is exactly the drift that made the app shell worth extracting.

- [x] ~~**`apps/admin/vercel.json` is an empty `{}`**~~ **MOOT 2026-09-08** — it now
  carries the daily `/api/cron/health` schedule, so it is real configuration again.

- [ ] **The admin ADMIN lockup is a PNG, so its black is baked in.** It will not
  invert if dark mode is ever switched on, and the customer app's wordmark is an
  SVG that would. On the day dark mode is enabled, this needs an SVG or a second
  file. `apps/admin/public/logo-wide-admin.png`, pointed at by `logoSrc` in the
  admin `ShellClient`.

- [ ] **The admin app's inner pages are themed but still hand-rolled markup** — customer
  detail, devices, billing. They pick up the design system's colours and type through the
  token bridge, but do not use the ported primitives. Follow-up to the design-system pass.

- [ ] **The threshold-history backfill used `-infinity`**, so readings predating the
  migration are still judged against today's threshold — the exact behaviour the feature
  removes. Accepted at the time because those were test runs. If any pre-migration reading
  ever needs to be defensible, this is the gap.
