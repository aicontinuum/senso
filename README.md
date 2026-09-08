# Senso

Temperature-monitoring compliance for food businesses in Qatar. Wireless sensors
in fridges and freezers report every 15 minutes; the platform stores every
reading, emails when one goes out of range or a sensor goes quiet, and produces
the monitoring reports an inspector asks for.

**The product is the record.** Almost every unusual decision in this codebase
follows from that: history is never destroyed, a reading is judged against the
limits that applied when it was taken, and a report refuses to generate rather
than print something plausible and wrong.

---

## The shape of it

```
Dragino LHT65N-E3 sensors  ──LoRaWAN EU868──▶  SenseCAP M2 gateway
                                                      │  packet forwarder, UDP 1700
                                                      ▼
                                    ChirpStack  (self-hosted, lns.sensoqa.com)
                                                      │  HTTP integration, bearer token
                                                      ▼
                        admin.sensoqa.com /api/ingest  ──▶  Supabase (PostgreSQL)
                                                      │
                                                      ▼
                        app.sensoqa.com — the customer's dashboard and reports
```

Two separate Next.js apps, deliberately sharing no session or auth context:

| | Who uses it | Where |
|---|---|---|
| `apps/customer` | Restaurant staff — readings, alerts, reports | app.sensoqa.com |
| `apps/admin` | Senso staff — customers, devices, billing, **and the API routes** | admin.sensoqa.com |

`/api/ingest` and `/api/cron/*` both live in the admin app.

## Repository map

```
apps/customer        Customer site (Next.js App Router)
apps/admin           Admin site + every API route
packages/tokens      Design-system CSS, vendored verbatim — diff, don't hand-merge
packages/ui          App shell shared by both sites (AppShell, Sidebar, Header, Logo)
packages/types       Shared TypeScript types
packages/status      Freshness and battery rules used by both sites
packages/mock-data   Pre-Supabase fixtures; still referenced in places
supabase/migrations  SQL, applied by hand — see below
network-server/      ChirpStack VPS as-built, including the alert crontab
```

The Raspberry Pi/ESP32 prototype kit that preceded LoRaWAN was removed on
2026-09-08, together with its `/api/heartbeat` endpoint and the reading
simulator that spoke its format. `DEVLOG.md` and `MIGRATION.md` keep the history.

## Running it

Node 22, npm workspaces.

```bash
npm install
npm run dev:customer     # :3000
npm run dev:admin        # :3001
```

Each app needs its own `.env.local`; copy the `.env.example` beside it. The
admin app needs considerably more, because it holds the service-role key and
every integration secret.

```bash
npm run build --workspace=apps/customer
npm run build --workspace=apps/admin
```

## Migrations — read this before running one

`supabase/migrations/*.sql` are applied **by hand** in the Supabase SQL editor.
There is no migration runner.

**Run them block by block.** Pasting a whole file has twice run only as far as
the first `$$`-quoted function body and silently skipped everything after it,
with no error shown. Every migration is marked with `── Block n ──` and ends
with verification queries.

**Then run the verification queries.** Both partial applications were invisible
from the UI: one rendered "No limit set" on every report row, the other left the
alert sender claiming nothing and sending nothing while looking healthy.

## Invariants — things a change must not break

1. **History is never destroyed.** `readings` and `alert_logs` are `ON DELETE
   RESTRICT`; devices are retired with `decommissioned_at`, never deleted.
   Reports deliberately still list retired sensors.
2. **A reading is judged against the threshold in force when it was recorded**,
   resolved through `alert_threshold_history`. Editing a limit must not invent
   past violations or erase real ones.
3. **A sensor is not in the record until it is commissioned.** Until
   `commissioned_at` is stamped at installation, its readings are stored but
   raise no alerts and appear in no report — a bench test at office temperature
   must never land in a customer's record as a fridge failure.
4. **RLS is the authority on who sees what**, not application code. Customers
   are scoped to their own data by policy; note that RLS *filters* rather than
   errors, so an unauthorised write comes back as zero rows and must be checked
   for explicitly.
5. **Column-scoped grants matter.** Customers may write only `sensors.name` and
   `alert_comments.body`. This is why the comment API reads then writes instead
   of upserting: PostgREST's upsert names every column in its `on conflict`
   clause, and PostgreSQL checks UPDATE privilege on all of them.
6. **A report refuses rather than misleads.** If threshold history cannot be
   read, generation fails loudly. A compliance document built from a failed
   query is worse than no document.
7. **Storing a reading never depends on an email going out.** Delivery lives in
   the scheduler, not in ingest.

## Where things stand

Live and in production. Real readings since 2026-08-28. Email alerting proven.
First restaurant deployment in progress with three sensors and one gateway.

**Read `DEVLOG.md` from the top** — it is a running record of what was built, why,
and what went wrong, most recent first. `TODO.md` holds everything still open,
including items closed as deliberate decisions so they are not re-raised.

Two open risks worth knowing on day one:

- **No database backups.** Supabase's free tier has none at all. For a product
  whose value is the record, this is the largest remaining exposure.
- **The alert scheduler runs from the ChirpStack VPS.** A daily watchdog catches
  it stopping; the external dead-man's-switch that would catch it within minutes
  is not built yet.

## The documents

| File | What it is |
|---|---|
| `SENSO.md` | Project bible — business model, both sites, data model, vocabulary |
| `CLAUDE.md` | Working rules for anyone (or anything) writing code here |
| `DEVLOG.md` | What was built each session, and the reasoning. Most recent first. |
| `TODO.md` | Open work, ranked. Includes decisions deliberately closed. |
| `MIGRATION.md` | The LoRaWAN migration, complete. Useful history. |
| `ONBOARDING.md` | Runbook for adding a sensor or gateway, start to finish |
| `network-server/README.md` | The VPS as built, including the alert crontab |
