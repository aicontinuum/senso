#!/usr/bin/env bash
# Senso gateway heartbeat — a liveness pulse to the platform, sent every 60s
# by senso-heartbeat.timer. Independent of temperature forwarding: it says
# "this gateway is alive and online" even when no sensors are reporting.
set -u

CONF=/etc/senso/gateway.env
[ -r "$CONF" ] && . "$CONF"
: "${GATEWAY_MAC:=}"
: "${API_BASE:=}"
: "${GATEWAY_SECRET:=}"
API_BASE="${API_BASE%/}"   # tolerate a trailing slash

if [ -z "$GATEWAY_MAC" ] || [ -z "$API_BASE" ] || [ "$GATEWAY_MAC" = "REPLACE_WITH_GATEWAY_EUI" ]; then
  logger -t senso-heartbeat "Not configured — set GATEWAY_MAC and API_BASE in $CONF"
  exit 0
fi

# Retry transient failures (DNS blips, cold starts) so a single hiccup doesn't
# cost a whole beat; -m caps the total time across all attempts, safely under
# the 60s pulse interval.
if curl -fsS --retry 2 --retry-all-errors --retry-delay 3 --connect-timeout 5 -m 30 -X POST "$API_BASE/api/heartbeat" \
     -H 'Content-Type: application/json' \
     -H "Authorization: Bearer ${GATEWAY_SECRET}" \
     -d "{\"mac_address\":\"$GATEWAY_MAC\"}" >/dev/null 2>&1; then
  exit 0
fi

# A failed pulse is expected during an outage — log it, don't fail the unit.
logger -t senso-heartbeat "Heartbeat POST to ${API_BASE} failed"
exit 0
