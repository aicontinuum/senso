# Pre-Launch TODO

## Security

- [ ] **Tighten `customers_update_own_record` RLS policy** — current policy allows customers to UPDATE any column on their own row. The API only passes through `contact_name`, `phone`, and `alert_recipients`, but the DB policy is broader. Before go-live, restrict it to only those three columns using a Postgres function or column-level grants, so a direct API call can't touch `email`, `name`, or `billing_status`.

- [ ] **Secure the ingest API (`POST /api/ingest`)** — currently authenticates gateways by MAC address alone. Any party who knows a registered MAC can post readings. Before go-live, replace with HMAC-signed payloads or a per-gateway shared secret header so only the physical device can ingest data.

- [ ] **Rate limit `/api/ingest`** — no rate limiting in place. A bad actor (or a misconfigured device) could flood the endpoint and bloat the readings table. Add rate limiting per MAC address before go-live.

## Database

- [ ] **Readings data retention policy** — the `readings` table grows indefinitely (every simulator/device tick adds a row, nothing is ever deleted). Before go-live, define a retention window (e.g. keep 2 years, archive or delete older rows) and set up a scheduled job (Supabase cron or pg_cron) to enforce it.

## Hardware / Ingest

- [ ] **Pi gateway watchdog / auto-restart** — the gateway hung and went silent for ~3 days until it was manually unplugged and replugged. Add a watchdog so it self-recovers: run the forwarder as a systemd service with `Restart=always` (+ `WatchdogSec`), and/or enable the Pi's hardware watchdog (`/dev/watchdog`) so a fully-hung Pi reboots itself. No manual power-cycle should ever be needed.

- [ ] **Duplicate readings from the gateway** *(pinned 2026-06-28, fix next session)* — every reading lands in the DB **twice**, ~3–5s apart with an identical value (e.g. `14.81 @ 17:14:48` and `17:14:45`; `11.68 @ 17:09:49` and `17:09:44`). Confirmed NOT the website (it stores/draws what it's given) and NOT the ESP32 (serial prints one `Transmitted OK` per 5-min cycle). Source is the **Raspberry Pi gateway** — most likely a slow POST to `/api/ingest` that times out and gets **retried, while the first POST also succeeded** (matches the earlier "it was slow"). Fix options: (a) fix the Pi forwarder's timeout/retry so it doesn't double-post — need to see the Pi code; and/or (b) add a server-side dedupe guard in `/api/ingest` (drop a reading for the same sensor if an identical one landed within the last few seconds — must be tuned so it doesn't drop legitimate readings when the test TX interval is short). Real readings are 5 min apart, so a short time-window dedupe is safe at the production cadence.
