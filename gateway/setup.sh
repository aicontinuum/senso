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

echo "3/4  Installing the connectivity watchdog…"
install -m 755 "$DIR/net-watchdog.sh"      /usr/local/bin/net-watchdog.sh
install -m 644 "$DIR/net-watchdog.service" /etc/systemd/system/net-watchdog.service
install -m 644 "$DIR/net-watchdog.timer"   /etc/systemd/system/net-watchdog.timer

echo "4/4  Enabling the watchdog timer…"
systemctl daemon-reload
systemctl enable --now net-watchdog.timer

echo
echo "Done. Reboot to apply the Wi-Fi power-save setting:  sudo reboot"
echo "(Not restarting NetworkManager here, so an SSH-over-Wi-Fi session isn't dropped mid-setup.)"
