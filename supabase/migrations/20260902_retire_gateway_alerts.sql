-- Stop alerting customers about gateways.
--
-- `gateways.last_seen_at` is stamped by /api/ingest on every reading, so
-- "gateway offline" was never an independent health signal: it meant "no
-- readings from this site in 35 minutes", which is exactly what the sensor
-- sweep already measures. The same fact arrived twice by two routes, and with
-- one sensor per gateway it was literally the same event fired twice.
--
-- It also put our infrastructure into the customer's inbox. A dark site is real
-- and worth knowing, but it is a Senso problem — it now shows on the admin
-- dashboard instead of emailing the customer about a box they never see.
--
-- The `gateway_offline` value stays in the alert_kind enum: past rows are
-- history, protected by RESTRICT like every other history row. Nothing raises
-- it any more.
--
-- Single statement, safe to paste whole.

-- Open gateway alerts used to be resolved by the same sweep loop that raised
-- them. That loop is gone, so without this they would stay open forever —
-- showing as Active, and holding a partial unique index slot against a gateway
-- that will never alert again.
update alert_logs
   set is_resolved = true
 where kind = 'gateway_offline'
   and is_resolved = false;

-- Verification — expect 0.
--
--   select count(*) from alert_logs
--    where kind = 'gateway_offline' and is_resolved = false;
