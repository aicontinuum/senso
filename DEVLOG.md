# Senso Dev Log

Running record of what was built each session. Most recent first.

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
