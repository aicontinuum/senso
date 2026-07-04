#!/usr/bin/env bash
# Senso gateway Wi-Fi connectivity watchdog.
# Runs once per minute (via net-watchdog.timer). Pings a target; on sustained
# failure it escalates recovery: force-reconnect -> restart NetworkManager ->
# reboot. NetworkManager's own autoconnect handles clean AP-returns; this is
# the safety net for when the driver/NM gets wedged.
set -u

# ── Tunables ──────────────────────────────────────────────────────────────
PING_TARGET="1.1.1.1"   # what "connected" means; a router IP also works
BOUNCE_AFTER=2          # minutes down before forcing a reconnect
RESTART_AFTER=5         # minutes down before restarting NetworkManager
REBOOT_AFTER=15         # minutes down before rebooting (0 = never reboot)
STATE_FILE="/run/net-watchdog.fails"
# ──────────────────────────────────────────────────────────────────────────

# Connectivity check — succeed if either of two pings gets a reply.
if ping -c 2 -W 3 "$PING_TARGET" >/dev/null 2>&1; then
  echo 0 > "$STATE_FILE"
  exit 0
fi

fails=$(( $(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE_FILE"
logger -t net-watchdog "No connectivity to ${PING_TARGET} (consecutive failures: ${fails})"

# Auto-detect the active Wi-Fi connection + device (nothing hard-coded).
con="$(nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | awk -F: '$2=="802-11-wireless"{print $1; exit}')"
dev="$(nmcli -t -f DEVICE,TYPE device status 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}')"

if [ "$REBOOT_AFTER" -gt 0 ] && [ "$fails" -ge "$REBOOT_AFTER" ]; then
  logger -t net-watchdog "Still down after ${fails} min — rebooting"
  /sbin/reboot
elif [ "$fails" -ge "$RESTART_AFTER" ]; then
  logger -t net-watchdog "Restarting NetworkManager"
  systemctl restart NetworkManager
elif [ "$fails" -ge "$BOUNCE_AFTER" ]; then
  logger -t net-watchdog "Bouncing Wi-Fi (device=${dev:-unknown} connection=${con:-unknown})"
  [ -n "$dev" ] && nmcli device disconnect "$dev" >/dev/null 2>&1
  [ -n "$con" ] && nmcli connection up "$con" >/dev/null 2>&1
fi
