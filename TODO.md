# Pre-Launch TODO

## Security

- [ ] **Tighten `customers_update_own_record` RLS policy** — current policy allows customers to UPDATE any column on their own row. The API only passes through `contact_name`, `phone`, and `alert_recipients`, but the DB policy is broader. Before go-live, restrict it to only those three columns using a Postgres function or column-level grants, so a direct API call can't touch `email`, `name`, or `billing_status`.

- [x] ~~**Secure the ingest API (`POST /api/ingest`)**~~ — DONE. `/api/ingest` and `/api/heartbeat` now require a per-gateway secret (`Authorization: Bearer`), verified constant-time against `gateways.secret`; the forwarder + heartbeat send it, `setup.sh` auto-generates it. **Go-live hardening still TODO:** enforcement is currently "only if a secret is set" (so an un-provisioned gateway is still open) — before launch, make it strict (reject when no secret) and ensure every gateway row has a secret. Consider upgrading to HMAC-signed payloads with a nonce/timestamp to prevent replay.

- [ ] **Rate limit `/api/ingest`** — no rate limiting in place. A bad actor (or a misconfigured device) could flood the endpoint and bloat the readings table. Add rate limiting per MAC address before go-live.

## Database

- [ ] **Readings data retention policy** — the `readings` table grows indefinitely (every simulator/device tick adds a row, nothing is ever deleted). Before go-live, define a retention window (e.g. keep 2 years, archive or delete older rows) and set up a scheduled job (Supabase cron or pg_cron) to enforce it.

## Hardware / Ingest

- [x] ~~**Pi gateway watchdog / auto-restart**~~ — DONE. Forwarder runs as `senso-forwarder.service` with `Restart=always`; net-watchdog handles network drops; hardware watchdog (`watchdog.conf` + `dtparam=watchdog=on`) reboots a fully-frozen Pi. All in `gateway/`.

- [x] ~~**Duplicate readings from the gateway**~~ — DONE. Root cause was the LoRa concentrator reporting each uplink on multiple channels. Fixed with content-window dedup in `senso_forwarder.py` + a `UNIQUE(sensor_id, recorded_at)` index and upsert-ignore in `/api/ingest`. (The `accepted: 2` scare was a separate double-count bug in the ingest response, also fixed.)

- [ ] **Clean up pre-fix duplicate rows** — the `readings` table still holds the duplicate rows created before the dedup fixes. One-off `DELETE` keeping the earliest per (sensor_id, recorded_at)-ish group. Cosmetic; do before any historical reporting matters.

- [ ] **DS3231 RTC for the gateway** — the Pi Zero has no real-time clock, so timestamps during a long outage that includes a reboot can drift until NTP resyncs. A ~$3 DS3231 module gives minute-perfect offline timestamps. Optional hardware add.

## Gateway provisioning

- [ ] **Golden SD-card image** — build a master image so a new gateway is "flash card → plug in → running" instead of provisioning from scratch. Must handle the **per-gateway identity**: the LoRa concentrator EUI differs per device, so it can't be baked into a shared image. Plan: have the heartbeat auto-derive the gateway EUI from the concentrator's `lora_pkt_fwd` config (the forwarder already reads it from each packet) so `/etc/senso/gateway.env` needs no per-device editing — then the image is truly generic. Capture the image after `gateway/setup.sh` is run and verified on a reference Pi.
