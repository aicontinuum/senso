-- Remove the per-gateway secret left over from the Pi kit.
--
-- `gateways.secret` was the bearer token the retired Raspberry Pi forwarder and
-- its heartbeat.sh sent with every request. The LoRaWAN chain never used it:
-- ChirpStack authenticates to /api/ingest with the single
-- CHIRPSTACK_INGEST_SECRET, and ingest stamps `last_seen_at` itself. The only
-- reader, /api/heartbeat, has been deleted along with the gateway/ kit.
--
-- Left in place the column is a credential with no purpose that the customer
-- SELECT policy on `gateways` still exposes to the owning account. Dropping it
-- is the fix; there is nothing to migrate.
--
-- Single statement — safe to paste whole.

alter table gateways drop column if exists secret;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect zero rows.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'gateways' and column_name = 'secret';
