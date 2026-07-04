#!/usr/bin/env bash
# Provision Wi-Fi resilience on a Senso gateway (Raspberry Pi + NetworkManager).
# Idempotent — safe to re-run. Run with sudo from this directory:
#   sudo ./setup.sh   &&   sudo reboot
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo ./setup.sh" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "1/4  Installing Wi-Fi power-save drop-in…"
install -m 644 "$DIR/wifi-powersave-off.conf" /etc/NetworkManager/conf.d/wifi-powersave-off.conf

echo "2/4  Enabling autoconnect with unlimited retries…"
con="$(nmcli -t -f NAME,TYPE connection show --active | awk -F: '$2=="802-11-wireless"{print $1; exit}')"
if [ -n "${con:-}" ]; then
  nmcli connection modify "$con" connection.autoconnect yes connection.autoconnect-retries 0
  echo "     autoconnect on '$con' (retries: unlimited)"
else
  echo "     WARNING: no active Wi-Fi connection found — skipping autoconnect tweak." >&2
  echo "     Re-run this script once the Pi is connected to Wi-Fi." >&2
fi

echo "3/5  Installing the connectivity watchdog…"
install -m 755 "$DIR/net-watchdog.sh"      /usr/local/bin/net-watchdog.sh
install -m 644 "$DIR/net-watchdog.service" /etc/systemd/system/net-watchdog.service
install -m 644 "$DIR/net-watchdog.timer"   /etc/systemd/system/net-watchdog.timer

echo "4/5  Installing the heartbeat…"
install -d -m 755 /etc/senso
if [ ! -e /etc/senso/gateway.env ]; then
  install -m 644 "$DIR/gateway.env.example" /etc/senso/gateway.env
  NEEDS_CONFIG=1
fi
install -m 755 "$DIR/heartbeat.sh"           /usr/local/bin/senso-heartbeat.sh
install -m 644 "$DIR/senso-heartbeat.service" /etc/systemd/system/senso-heartbeat.service
install -m 644 "$DIR/senso-heartbeat.timer"   /etc/systemd/system/senso-heartbeat.timer

echo "5/5  Enabling the timers…"
systemctl daemon-reload
systemctl enable --now net-watchdog.timer
systemctl enable --now senso-heartbeat.timer

echo
if [ "${NEEDS_CONFIG:-0}" = "1" ]; then
  echo ">>> ACTION NEEDED: edit /etc/senso/gateway.env with your GATEWAY_MAC (EUI)"
  echo "    and API_BASE, then:  sudo systemctl restart senso-heartbeat.timer"
  echo
fi
echo "Done. Reboot to apply the Wi-Fi power-save setting:  sudo reboot"
echo "(Not restarting NetworkManager here, so an SSH-over-Wi-Fi session isn't dropped mid-setup.)"
