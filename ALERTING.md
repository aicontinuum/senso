# Alerting v2

How Senso decides a fridge is in trouble, how it tells the customer, and how it
notices when the trouble is on our side. Written 2026-09-10 after a night of false
"sensor has stopped reporting" emails. This file is the design and the phase
tracker; `DEVLOG.md` has the session-by-session record.

## The two rules

1. **Never infer an incident from what was not found.** Every alert must be
   provable from a fact stored on a row, evaluated inside the transaction that
   stored it, or by one SQL statement that runs whole or not at all. A failed
   lookup and a true negative must never be the same value.
2. **A customer is only ever told about their own fridges.** When Senso's own
   infrastructure fails, Senso is told, the customer is not, and what to say to
   them is a human decision.

## Why

On 2026-09-09 the offline sweep asked Supabase over the network for recent
readings and treated any sensor absent from the answer as silent. The answer
came back empty a few times overnight. An empty answer and a dead fleet look
identical, so the sweep opened an alert, emailed it, and resolved it five minutes
later — four times in ten hours, for a sensor that reported every fifteen minutes
without missing one. The query error was discarded, so nothing was logged, and
the single `job_heartbeats` row was overwritten by the next run, so nothing was
left to read in the morning. The immediate fix (check the error, raise nothing on
failure) closed one door. The design below removes the shape of the bug.

## The shape

```
Dragino sensor ──LoRaWAN──▶ SenseCAP gateway ──▶ ChirpStack (VPS) ──HTTP──▶ /api/ingest
                                                       │ 1-min pulse                │ insert only
                                                       ▼                            ▼
                                        ┌──────────── Postgres (Supabase) ─────────────────┐
                                        │  platform_status   ◀── pulse, ingest, jobs       │
                                        │  readings ─trigger─▶ sensors.last_reading_at     │
                                        │                      + threshold alerts          │
                                        │  pg_cron sweep ────▶ alert_logs (offline)        │
                                        │  pg_cron watchdog ─▶ level changed? ─────────────┼──▶ OPS_ALERT_EMAIL
                                        │  pg_cron ──pg_net──▶ /api/alerts/send (Vercel) ──┼──▶ customer email
                                        │  job_runs · alert_notifications (append-only)    │
                                        └──────────────────────────────────────────────────┘
```

The device writes, the database decides, Vercel delivers. Nothing outside the
database can open or close an alert.

## Components

| Piece | What it does | Status |
|---|---|---|
| `sensors.last_reading_at` / `last_reading_id` / `last_temperature` | Stamped by an after-insert trigger on `readings`, same transaction, never moves backwards. The single source of truth for "is this sensor reporting". | **Live** (phase 1). Not yet read by anything. |
| `platform_status` | One row of last-seen stamps. VPS pulse every minute via `POST /api/platform/pulse` (with `chirpstack_ok` from a local health check), every authenticated ChirpStack event via ingest, each successful sweep / send run. | **Live** (phase 2). |
| VPS watchdog card | First tile on the admin dashboard. Down when the pulse is 10 min stale or reported ChirpStack not answering; late when a job is 15 min stale or no uplink inside the sensor window. Rules in `apps/admin/lib/platform-status.ts`. | **Live** (phase 2). |
| `job_runs` | One row per job per run (`sweep`, `sender`, `watchdog`), with skip reasons and errors. Pruned after 90 days by pg_cron. | **Live** (phase 2). |
| `alert_notifications` | One row per customer email attempt: alert ids, recipients, Resend id or error. Compliance answer to "when were you told". | **Live** (phase 2). |
| Platform watchdog | pg_cron every 5 min → pg_net → `POST /api/platform/watchdog` (secret in Vault). Emails `OPS_ALERT_EMAIL` once per level change: down, late, recovered. Never a customer. | **Live** (phase 2b). Email path not yet exercised — see runbook test. |
| Ingest as a writer | Keeps auth and validation; 6-hour lower bound on `time`; dedup on `deduplicationId`; no threshold logic. | **Live** (phase 4). |
| Threshold alerts in the trigger | Opened/closed in the same transaction as the reading, only for the sensor's newest reading, only when commissioned, only active limits. | **Live** (phase 4). Decided: the cabinet. |
| `sweep_offline_sensors()` | pg_cron every 5 min. Four statements on `sensors` and `alert_logs`: open where the stamp is past the window, close where fresh or out of service, close stranded threshold alerts. Holds while the platform is down. No readings scan, no row limit, no network. | **Live** (phase 4). |
| Sender hold | `/api/cron/alerts` reads `platform_status` and claims nothing while the platform is down. | **Live** (phase 4). |
| Fixture tests | `supabase/tests/alerting-v2/`: live-schema fixture + 33 asserting cases against PostgreSQL 16. | **Live**. Re-run before any change to the trigger or sweep. |
| Delivery triggered from the database | pg_cron → pg_net → sender, same claim/mark/release functions as today. Sender also holds while the platform is down. VPS alert crontab removed. | Phase 5 |
| Read the snapshot everywhere | Customer and admin pages use `last_reading_at` instead of scanning readings. | Phase 6 |

## What happens when

| Failure | Result | Customer | Senso |
|---|---|---|---|
| Supabase API flaky at 3 a.m. (the 9 Sept case) | Nothing. Detection no longer crosses the network. | nothing | nothing to see |
| **VPS dies** | Pulse stops; platform marked down at 10 min; sweep and sender hold | nothing | card red; one email within 10 min; one on recovery |
| ChirpStack crashed, VPS up | Pulse continues with `chirpstack_ok=false`; same hold | nothing | card names the container, not the box |
| Postgres down | Nothing runs; ChirpStack retries ingest | nothing | daily Vercel health check emails |
| Vercel / sender down | Alerts open and wait; sent on first good run | late email | sender stamp stale; card amber; email at 15 min |
| Resend rejects | Claim released, retried; attempt logged | late email | `alert_notifications` row, status failed |
| Two uplinks lost over LoRa | Sensor stamp ages past 35 min; real alert; resolves on next reading | real offline alert | correct |
| **One site's gateway dark**, platform fine | Every sensor there stale together; sweep opens them | one email listing that site's sensors | "Sites dark" tile |
| Sensor retired with an alert open | Sweep closes it | alert closes | — |
| pg_cron stops | No sweeps, no sends; threshold alerts still open via trigger | late email | daily Vercel health check (phase 5 points it at `platform_status`) |

## Decisions

- **Dark site → customer is told.** Decided 2026-09-10, unchanged from today. All
  sensors at one restaurant down at once is itself the signal that the fault is
  bigger than a sensor, and only the customer can plug the gateway back in.
- **Platform failure → Senso only.** `OPS_ALERT_EMAIL`, one email per transition.
  No customer hears about our VPS, ChirpStack, Vercel or Supabase.
- **Uplink stamp is informational, not a "down" signal.** With a small fleet it is
  only as fresh as the last sensor to transmit. Down is decided by the two direct
  signals from the box: the pulse stopping, or the pulse saying ChirpStack is not
  answering.
- **No debounce on the SQL sweep.** It existed to survive a flaky query; inside
  Postgres the statement runs whole or not at all.
- **Offline window stays 35 minutes** until LoRa loss at a site says otherwise.
- **Notification records are history**, kept forever like readings. `job_runs` is
  operational and pruned at 90 days.

## Rollout

| Phase | Content | Status |
|---|---|---|
| 1 | Snapshot columns + trigger + backfill | Live 2026-09-10 |
| 2 | `platform_status`, ledgers, pulse route, ingest stamp, dashboard card | Live 2026-09-10 |
| 2b | Watchdog job in pg_cron, ops email | Live 2026-09-10 (email untested) |
| 3 | Shadow week | Skipped 2026-09-10 — no real customers yet; replaced by the fixture tests and a two-day consistency query (DEVLOG) |
| 4 | Cut over: SQL sweep → `alert_logs`; `sweepForSilence` deleted; thresholds in the trigger; ingest window + dedup; sender hold | Live 2026-09-10 |
| 5 | pg_net-triggered delivery; remove VPS alert crontab; drop `job_heartbeats`; health check reads `platform_status` | Next |
| 6 | Pages read `last_reading_at` | — |

Each migration under `supabase/migrations/2026091*` is applied by hand, block by
block, verification query after each block — see the root README.

## Runbooks

- Installing the VPS pulse and testing the watchdog email:
  `network-server/README.md`, "Platform pulse".
- If the watchdog gets 401s: the Vault `cron_secret` does not match Vercel's
  `CRON_SECRET`. The value is in `/etc/senso/alerts.env` on the VPS. Check with
  `select name, length(decrypted_secret) from vault.decrypted_secrets;` — expect
  one row, `cron_secret`, 64.
- Reading the evidence after a strange night:
  `select * from job_runs order by started_at desc limit 50;` and
  `select * from alert_notifications order by attempted_at desc limit 20;`.
